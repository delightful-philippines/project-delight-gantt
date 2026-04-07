import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '../db.js';
import { requireUser } from '../middleware/auth.js';
import { buildPMSExcel, scoreToRating } from '../pmsExcel.js';

const QUARTER_MONTHS = {
  1: ['January', 'February', 'March'],
  2: ['April', 'May', 'June'],
  3: ['July', 'August', 'September'],
  4: ['October', 'November', 'December'],
};

const MONTH_INDEX = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

function getQuarterDateRange(year, quarter) {
  const months = QUARTER_MONTHS[quarter];
  const startMonthIdx = MONTH_INDEX[months[0]];
  const endMonthIdx = MONTH_INDEX[months[2]];
  const start = new Date(year, startMonthIdx, 1);
  const end = new Date(year, endMonthIdx + 1, 0); // last day of last month
  return { start, end, months };
}

function taskMonthName(endDateStr, year, quarter) {
  const d = new Date(endDateStr);
  const months = QUARTER_MONTHS[quarter];
  for (const m of months) {
    if (d.getMonth() === MONTH_INDEX[m] && d.getFullYear() === year) return m;
  }
  // fallback: assign to last month of quarter
  return months[months.length - 1];
}

function isEmailMatch(email, ...candidates) {
  const norm = (v) => (v || '').toLowerCase().trim();
  const e = norm(email);
  return e ? candidates.some(c => norm(c) === e) : false;
}

function isLeadMatch(lead, employeeId, employeeEmail) {
  if (!lead) return false;
  const idMatch = lead.toLowerCase().match(/^id:(\d+)$/) || lead.match(/^(\d+)$/);
  if (idMatch) return parseInt(idMatch[1], 10) === employeeId;
  return isEmailMatch(lead, employeeEmail);
}

const router = Router();

router.post('/generate_update', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(400).json({ error: 'GEMINI_API_KEY is missing from environment variables.' });
        }

        const { context, currentTasks, project } = req.body;
        if (!context || !project) {
            return res.status(400).json({ error: 'Missing context or project details.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                maxOutputTokens: 8192,
            },
        });

        // Trim to title only — UUIDs in prompt waste input tokens
        const existingTasksSummary = (currentTasks || []).map((t) => ({ id: t.id, title: t.title }));

        const prompt = `You are a Project Manager AI. Output ONLY a raw JSON array of operations — no markdown, no explanation.

Rules:
- "update_task": update an existing task by its id.
- "create_task": create a new task. Use a short "tempId" string so child tasks can reference the parent via "parentId". List parents BEFORE children.
- If context is a WBS, create ALL tasks in the hierarchy — do NOT skip or truncate any.
- If a WBS code like "1.1" is a child of "1", use tempId/parentId to reflect that nesting.
- If nothing needs to change, return [].

Schema (use exactly these fields, no extras):
update_task: {"type":"update_task","taskId":"<id>","changes":{"title":null,"start_date":null,"end_date":null,"progress":null,"assignee":null}}
create_task: {"type":"create_task","tempId":"t1","parentId":"<id or tempId or null>","task":{"title":"","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","progress":0,"assignee":null}}

Project: ${project.name} (starts ${project.start_date})
Existing tasks: ${JSON.stringify(existingTasksSummary)}
Context:
"""
${context}
"""`;

        const result = await model.generateContent(prompt);
        const candidate = result.response.candidates?.[0];
        const finishReason = candidate?.finishReason;

        console.log('[AI] finishReason:', finishReason, '| parts:', candidate?.content?.parts?.length);

        let textResult;
        try {
            textResult = result.response.text().trim();
        } catch (textErr) {
            console.error('[AI] response.text() threw:', textErr.message, '| finishReason:', finishReason);
            throw new Error(`AI response error (finishReason: ${finishReason}): ${textErr.message}`);
        }

        // Remove markdown fences if model included them
        if (textResult.startsWith('```json')) {
            textResult = textResult.replace(/^```json/m, '').replace(/```$/m, '').trim();
        } else if (textResult.startsWith('```')) {
            textResult = textResult.replace(/^```/m, '').replace(/```$/m, '').trim();
        }

        console.log('[AI] output length:', textResult.length, '| preview:', textResult.slice(0, 120));

        let operations;
        try {
            operations = JSON.parse(textResult);
        } catch (parseErr) {
            console.error('[AI] JSON parse failed. finishReason:', finishReason, '| Raw (first 800):', textResult.slice(0, 800));
            throw new Error(`AI returned invalid JSON (finishReason: ${finishReason}): ${parseErr.message}`);
        }

        res.json({ operations });
    } catch (error) {
        console.error('[AI] Generation error:', error);
        res.status(500).json({ error: error.message || 'AI processing failed' });
    }
});

router.post('/generate_pms', requireUser, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'GEMINI_API_KEY is missing.' });

    const { employeeEmail, employeeId, employeeName, employeePosition, employeeBusinessUnit, year, quarter } = req.body;
    if (!employeeEmail || !year || !quarter) {
      return res.status(400).json({ error: 'Missing employeeEmail, year, or quarter.' });
    }

    const { start, end, months } = getQuarterDateRange(Number(year), Number(quarter));
    const quarterLabel = `${months[0]} 01 - ${months[2]} ${end.getDate()}, ${year}`;

    // ── Fetch all projects and tasks ─────────────────────────
    const { data: allProjects, error: projErr } = await supabaseAdmin.from('projects').select('*').limit(10000);
    if (projErr) return res.status(500).json({ error: projErr.message });

    const { data: allTasks, error: taskErr } = await supabaseAdmin
      .from('tasks')
      .select('id, project_id, title, start_date, end_date, duration, progress, assignee, is_summary, parent_id')
      .limit(10000);
    if (taskErr) return res.status(500).json({ error: taskErr.message });

    // ── Identify lead projects ───────────────────────────────
    const leadProjectIds = new Set(
      (allProjects || [])
        .filter(p => isLeadMatch(p.lead, employeeId, employeeEmail))
        .map(p => p.id)
    );

    // ── Filter tasks: assignee OR in a lead project, non-summary only ─
    const candidateTasks = (allTasks || []).filter(t => {
      if (t.is_summary) return false;
      const isAssignee = isEmailMatch(t.assignee, employeeEmail);
      const isLeadProject = leadProjectIds.has(t.project_id);
      return isAssignee || isLeadProject;
    });

    // ── Filter to tasks ending within the quarter ────────────
    const quarterTasks = candidateTasks.filter(t => {
      if (!t.end_date) return false;
      const d = new Date(t.end_date);
      return d >= start && d <= end;
    });

    if (quarterTasks.length === 0) {
      return res.status(404).json({ error: 'No tasks found for this employee in the selected period.' });
    }

    // ── Deduplicate by task ID ───────────────────────────────
    const seen = new Set();
    const uniqueTasks = quarterTasks.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // ── Group by month ───────────────────────────────────────
    const tasksByMonth = {};
    for (const m of months) tasksByMonth[m] = [];
    for (const t of uniqueTasks) {
      const m = taskMonthName(t.end_date, Number(year), Number(quarter));
      tasksByMonth[m].push(t);
    }

    const activeMonths = months.filter(m => tasksByMonth[m] && tasksByMonth[m].length > 0);

    // ── Build Gemini prompt ──────────────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { maxOutputTokens: 8192 },
    });

    const taskInput = {};
    for (const m of activeMonths) {
      taskInput[m] = tasksByMonth[m].map(t => ({
        id: t.id,
        title: t.title,
        progress: t.progress,
        start_date: t.start_date,
        end_date: t.end_date,
        duration: t.duration,
      }));
    }

    const prompt = `You are a PMS (Performance Management System) analyst. Output ONLY raw JSON — no markdown, no explanation.

Employee: ${employeeName}, ${employeePosition || 'Staff'}, ${employeeBusinessUnit || ''}
Period: Q${quarter} ${year} (${quarterLabel})

For each task below, return:
- "id": same task id provided
- "goal": expanded professional description (task title + one sentence explaining business value, similar to: "Set up enrollment module database: Make the system capable of recording which employees are enrolled in which courses.")
- "kpi": always exactly this string: ">=N ( 100% average completion per month)"
- "ratings": always exactly this string: "1 - > 2 (93% - 100% Progress Rate, Zero Delay);\\n2 - 2 (1 - 15 days delay; 69% - 92.99% Progress Rate)\\n3 - 1 (93% - 100% Progress Rate, Zero Delay);\\n4 - 1 (1 - 15 days delay; 69% - 92.99% Progress Rate)\\n5 - 0 ( > 60 days delay; 0% progress)"
- "goal_weight": a float; all goal_weights in the same month must sum to exactly 1.0; assign heavier weight to tasks with longer duration or greater complexity

Return JSON in this exact shape:
{
  "tasksByMonth": {
    "April": [{ "id": "...", "goal": "...", "kpi": "...", "ratings": "...", "goal_weight": 0.12 }],
    "May": [...],
    "June": [...]
  }
}

Tasks:
${JSON.stringify(taskInput, null, 2)}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    if (text.startsWith('```json')) text = text.replace(/^```json/m, '').replace(/```$/m, '').trim();
    else if (text.startsWith('```')) text = text.replace(/^```/m, '').replace(/```$/m, '').trim();

    let aiResult;
    try {
      aiResult = JSON.parse(text);
    } catch (e) {
      console.error('[PMS AI] JSON parse failed:', text.slice(0, 400));
      return res.status(500).json({ error: 'AI returned invalid JSON.' });
    }

    // ── Merge AI output with task data, compute scores ───────
    const taskMap = Object.fromEntries(uniqueTasks.map(t => [t.id, t]));
    const pmsRows = [];
    const monthSummary = {};

    for (const m of activeMonths) {
      const aiRows = aiResult.tasksByMonth?.[m] || [];
      let monthTotal = 0;
      let number = 1;

      for (const aiRow of aiRows) {
        const task = taskMap[aiRow.id];
        if (!task) continue;

        const actual = parseFloat(((task.progress || 0) / 100).toFixed(4));
        const target = 1.0;
        const mPercent = parseFloat((actual / target).toFixed(4));
        const goalWeight = parseFloat((aiRow.goal_weight || 0).toFixed(4));
        const finalScore = parseFloat((mPercent * goalWeight).toFixed(4));

        monthTotal += finalScore;

        pmsRows.push({
          month: m,
          number: number++,
          goal: aiRow.goal || task.title,
          kpi: aiRow.kpi || '>=N ( 100% average completion per month)',
          ratings: aiRow.ratings || '',
          target,
          actual,
          mPercent,
          goalWeight,
          finalScore,
        });
      }

      const monthRows = pmsRows.filter(r => r.month === m);
      const rawMonthTotal = monthRows.reduce((sum, r) => sum + r.mPercent * r.goalWeight, 0);
      monthSummary[m] = {
        finalScore: parseFloat(rawMonthTotal.toFixed(4)),
        rating: scoreToRating(rawMonthTotal),
      };
    }

    // ── Guard: ensure AI produced rows ───────────────────────
    if (pmsRows.length === 0) {
      return res.status(500).json({ error: 'AI returned no matching PMS rows. Please try again.' });
    }

    // ── Build Excel ──────────────────────────────────────────
    const buffer = await buildPMSExcel({
      employee: {
        name: employeeName,
        position: employeePosition || '',
        businessUnit: employeeBusinessUnit || '',
      },
      year: Number(year),
      quarter: Number(quarter),
      quarterLabel,
      months: activeMonths,
      monthSummary,
      rows: pmsRows,
    });

    const safeName = (employeeName || 'Employee').replace(/[^a-zA-Z0-9]/g, '');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PMS_${year}_Q${quarter}_${safeName}.xlsx"`);
    res.send(buffer);

  } catch (error) {
    console.error('[PMS] Error:', error);
    res.status(500).json({ error: error.message || 'PMS generation failed.' });
  }
});

export default router;
