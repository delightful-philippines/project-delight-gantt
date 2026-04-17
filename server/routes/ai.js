import { Router } from 'express';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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

const PMS_DEFAULT_KPI = '>=N ( 100% average completion per month)';
const PMS_DEFAULT_RATINGS = '1 - > 2 (93% - 100% Progress Rate, Zero Delay);\n2 - 2 (1 - 15 days delay; 69% - 92.99% Progress Rate)\n3 - 1 (93% - 100% Progress Rate, Zero Delay);\n4 - 1 (1 - 15 days delay; 69% - 92.99% Progress Rate)\n5 - 0 ( > 60 days delay; 0% progress)';
const PMS_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    tasksByMonth: {
      type: SchemaType.OBJECT,
      properties: {
        January: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        February: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        March: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        April: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        May: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        June: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        July: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        August: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        September: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        October: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        November: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
        December: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              goal_weight: { type: SchemaType.NUMBER },
            },
            required: ['id', 'goal_weight'],
          },
        },
      },
    },
  },
  required: ['tasksByMonth'],
};

function buildPmsGoalLabel(task, projectName) {
  if (task?.isExtraNote) return (task.title || '').trim();

  const title = (task?.title || '').trim();
  const cleanProjectName = (projectName || '').trim();
  if (!cleanProjectName) return title;

  const normalizedTitle = title.toLowerCase();
  const normalizedProject = cleanProjectName.toLowerCase();
  if (normalizedTitle.includes(normalizedProject)) return title;

  return `${cleanProjectName}: ${title}`;
}

function normalizeWorkText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRedundantWorkItem(noteTitle, tasks) {
  const normalizedNote = normalizeWorkText(noteTitle);
  if (!normalizedNote) return true;

  return tasks.some(task => {
    const normalizedTask = normalizeWorkText(task?.title || '');
    if (!normalizedTask) return false;
    return normalizedTask.includes(normalizedNote) || normalizedNote.includes(normalizedTask);
  });
}

function parseExtraTaskNotes(extraTaskNote, months) {
  const parsed = Object.fromEntries(months.map(month => [month, []]));
  if (!extraTaskNote || typeof extraTaskNote !== 'string') return parsed;

  let currentMonth = null;
  for (const rawLine of extraTaskNote.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const monthMatch = line.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s*:?\s*$/i);
    if (monthMatch) {
      const monthName = monthMatch[1][0].toUpperCase() + monthMatch[1].slice(1).toLowerCase();
      currentMonth = months.includes(monthName) ? monthName : null;
      continue;
    }

    if (!currentMonth) continue;

    const cleaned = line.replace(/^[-*•]\s*/, '').trim();
    if (cleaned) parsed[currentMonth].push(cleaned);
  }

  return parsed;
}

function getQuarterDateRange(year, quarter) {
  const months = QUARTER_MONTHS[quarter];
  const startMonthIdx = MONTH_INDEX[months[0]];
  const endMonthIdx = MONTH_INDEX[months[2]];
  const start = new Date(year, startMonthIdx, 1);
  const end = new Date(year, endMonthIdx + 1, 0); // last day of last month
  return { start, end, months };
}

function parseDbDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, monthIndex, day);
}

function taskMonthName(endDateStr, year, quarter) {
  const d = parseDbDate(endDateStr);
  if (!d) return QUARTER_MONTHS[quarter][QUARTER_MONTHS[quarter].length - 1];
  const months = QUARTER_MONTHS[quarter];
  for (const m of months) {
    if (d.getMonth() === MONTH_INDEX[m] && d.getFullYear() === year) return m;
  }
  // fallback: assign to last month of quarter
  return months[months.length - 1];
}

function buildFallbackWeights(tasks) {
  const taskCount = tasks.length || 1;
  const rawWeights = tasks.map(task => Math.max(Number(task?.duration) || 1, 1));
  const total = rawWeights.reduce((sum, value) => sum + value, 0) || taskCount;

  return Object.fromEntries(
    tasks.map((task, index) => [task.id, rawWeights[index] / total])
  );
}

function normalizeMonthWeights(tasks, aiRows) {
  const fallbackWeights = buildFallbackWeights(tasks);
  const aiWeightById = Object.fromEntries(
    (aiRows || [])
      .filter(row => row?.id)
      .map(row => [row.id, Number(row.goal_weight)])
  );

  const positiveWeights = tasks.map(task => {
    const aiWeight = aiWeightById[task.id];
    if (Number.isFinite(aiWeight) && aiWeight > 0) return [task.id, aiWeight];
    return [task.id, fallbackWeights[task.id] || 0];
  });

  const totalWeight = positiveWeights.reduce((sum, [, weight]) => sum + weight, 0);
  if (!totalWeight) return fallbackWeights;

  return Object.fromEntries(
    positiveWeights.map(([taskId, weight]) => [taskId, weight / totalWeight])
  );
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

function parseProgressValue(value) {
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*%?$/);
  return match ? Math.min(100, Math.max(0, parseInt(match[1], 10))) : 0;
}

function parseCsvRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function extractWBSCsvFromMarkdown(text) {
  if (!text || typeof text !== 'string') return null;

  // Look for ```csv ... ``` code blocks
  const csvBlockRegex = /```csv\s*\n([\s\S]*?)\n```/;
  const match = text.match(csvBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // If no code block, return original text (might be raw CSV)
  return text;
}

function detectWbsCsv(text) {
  if (!text || typeof text !== 'string') return false;

  // Try to extract CSV from markdown
  const csvContent = extractWBSCsvFromMarkdown(text);
  if (!csvContent) return false;

  const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (lines.length < 2) return false;

  const headerLine = parseCsvRow(lines[0]);
  return (
    headerLine.length >= 4 &&
    headerLine[0].toLowerCase() === 'wbs' &&
    headerLine[1].toLowerCase().includes('task') &&
    headerLine[2].toLowerCase().includes('start') &&
    headerLine[3].toLowerCase().includes('end')
  );
}

function parseWBSCsv(csvText) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (lines.length < 2) return [];

  const headerLine = parseCsvRow(lines[0]);
  const wbsIdx = headerLine.findIndex(h => h.toLowerCase() === 'wbs');
  const taskIdx = headerLine.findIndex(h => h.toLowerCase().includes('task'));
  const startIdx = headerLine.findIndex(h => h.toLowerCase().includes('start'));
  const endIdx = headerLine.findIndex(h => h.toLowerCase().includes('end'));
  const progressIdx = headerLine.findIndex(h => h.toLowerCase().includes('progress'));

  if (wbsIdx === -1 || taskIdx === -1 || startIdx === -1 || endIdx === -1) {
    throw new Error('WBS CSV must have columns: WBS, Task, Start, End, [Progress]');
  }

  const rows = [];
  const wbsToTempId = new Map();
  const operations = [];

  // Parse CSV rows into structured data
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    const wbs = (cols[wbsIdx] || '').trim();
    if (!wbs) continue;

    const task = {
      wbs,
      title: (cols[taskIdx] || '').trim(),
      start_date: (cols[startIdx] || '').trim(),
      end_date: (cols[endIdx] || '').trim(),
      progress: progressIdx !== -1 ? parseProgressValue(cols[progressIdx]) : 0,
    };

    if (!task.title) continue;
    rows.push(task);
  }

  // Build operations with proper parent-child hierarchy
  for (const task of rows) {
    const tempId = `wbs_${task.wbs.replace(/\./g, '_')}`;
    wbsToTempId.set(task.wbs, tempId);

    // Find parent: if WBS is "1.1.1", parent is "1.1"; if "1.1", parent is "1"
    const parts = task.wbs.split('.');
    let parentId = null;
    if (parts.length > 1) {
      const parentWbs = parts.slice(0, -1).join('.');
      parentId = wbsToTempId.get(parentWbs) || null;
    }

    operations.push({
      type: 'create_task',
      tempId,
      parentId,
      task: {
        title: task.title,
        start_date: task.start_date || null,
        end_date: task.end_date || null,
        progress: task.progress,
        assignee: null,
      },
    });
  }

  return operations;
}

const router = Router();

router.post('/generate_update', async (req, res) => {
    try {
        const { context, currentTasks, project } = req.body;
        if (!context || !project) {
            return res.status(400).json({ error: 'Missing context or project details.' });
        }

        let operations = [];

        // Check if context is WBS CSV format — if so, parse directly without AI
        if (detectWbsCsv(context)) {
            console.log('[WBS Parser] Detected WBS CSV format. Parsing directly...');
            try {
                const csvContent = extractWBSCsvFromMarkdown(context);
                operations = parseWBSCsv(csvContent);
                console.log('[WBS Parser] Generated', operations.length, 'operations from CSV');
                return res.json({ operations });
            } catch (parseErr) {
                console.error('[WBS Parser] Error:', parseErr.message);
                throw new Error(`WBS CSV parsing failed: ${parseErr.message}`);
            }
        }

        // Otherwise, use Gemini AI for free-text parsing
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(400).json({ error: 'GEMINI_API_KEY is missing from environment variables.' });
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

    const { employeeEmail, employeeId, employeeName, employeePosition, employeeBusinessUnit, extraTaskNote, year, quarter } = req.body;
    if (!employeeEmail || !year || !quarter) {
      return res.status(400).json({ error: 'Missing employeeEmail, year, or quarter.' });
    }

    const { start, end, months } = getQuarterDateRange(Number(year), Number(quarter));
    const quarterLabel = `${months[0]} 01 - ${months[2]} ${end.getDate()}, ${year}`;

    // ── Fetch all projects and tasks ─────────────────────────
    const { data: allProjects, error: projErr } = await supabaseAdmin.from('projects').select('*').limit(10000);
    if (projErr) return res.status(500).json({ error: projErr.message });
    const projectMap = Object.fromEntries((allProjects || []).map(p => [p.id, p]));

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
      const d = parseDbDate(t.end_date);
      if (!d) return false;
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

    const parsedExtraTaskNotes = parseExtraTaskNotes(extraTaskNote, months);
    for (const m of months) {
      const existingTasks = tasksByMonth[m] || [];
      const extraTasks = (parsedExtraTaskNotes[m] || [])
        .filter(noteTitle => !isRedundantWorkItem(noteTitle, existingTasks))
        .map((noteTitle, index) => ({
          id: `extra-note:${m}:${index + 1}`,
          project_id: null,
          title: noteTitle,
          start_date: null,
          end_date: null,
          duration: 1,
          progress: 100,
          assignee: employeeEmail,
          is_summary: false,
          parent_id: null,
          isExtraNote: true,
        }));

      tasksByMonth[m].push(...extraTasks);
    }

    // ── Build Gemini prompt ──────────────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: PMS_RESPONSE_SCHEMA,
      },
    });

    const taskInput = {};
    for (const m of months) {
      taskInput[m] = tasksByMonth[m].map(t => ({
        id: t.id,
        project_name: projectMap[t.project_id]?.name || '',
        title: t.title,
        source_type: t.isExtraNote ? 'extra_note' : 'project_task',
        progress: t.progress,
        start_date: t.start_date,
        end_date: t.end_date,
        duration: t.duration,
      }));
    }

    const prompt = `You are a PMS (Performance Management System) analyst.

Employee: ${employeeName}, ${employeePosition || 'Staff'}, ${employeeBusinessUnit || ''}
Period: Q${quarter} ${year} (${quarterLabel})

For each task below, return:
- "id": same task id provided
- "goal_weight": a float; all goal_weights in the same month must sum to exactly 1.0; assign heavier weight to tasks with longer duration or greater complexity

Weighting rules:
- Use the project name to understand the task context
- Give higher weight to longer or more critical tasks
- Do not rewrite, rename, or summarize tasks; weights only
- Items with "source_type": "extra_note" came from the employee's manual monthly note and may cover work not tracked in project tasks
- If an extra note appears redundant with a tracked project task, keep its weight low so it does not double-count the same work

Return JSON in this exact shape:
{
  "tasksByMonth": {
    "April": [{ "id": "...", "goal_weight": 0.12 }],
    "May": [...],
    "June": [...]
  }
}

Tasks:
${JSON.stringify(taskInput, null, 2)}`;

    const result = await model.generateContent(prompt);
    const candidate = result.response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    let text = result.response.text().trim();
    if (text.startsWith('```json')) text = text.replace(/^```json/m, '').replace(/```$/m, '').trim();
    else if (text.startsWith('```')) text = text.replace(/^```/m, '').replace(/```$/m, '').trim();

    let aiResult;
    try {
      aiResult = JSON.parse(text);
    } catch (e) {
      console.error('[PMS AI] JSON parse failed. finishReason:', finishReason, '| Raw (first 800):', text.slice(0, 800));
      return res.status(500).json({ error: `AI returned invalid JSON (finishReason: ${finishReason || 'unknown'}).` });
    }

    // ── Merge AI output with task data, compute scores ───────
    const pmsRows = [];
    const monthSummary = {};

    for (const m of months) {
      const sourceTasks = tasksByMonth[m] || [];
      const aiRows = aiResult.tasksByMonth?.[m] || [];
      const normalizedWeights = normalizeMonthWeights(sourceTasks, aiRows);
      let number = 1;

      for (const task of sourceTasks) {
        // Count task as 100% achieved for the month it's assigned to, regardless of delays
        const actual = 1.0;
        const target = 1.0;
        const mPercent = parseFloat((actual / target).toFixed(4));
        const goalWeight = parseFloat((normalizedWeights[task.id] || 0).toFixed(4));
        const finalScore = parseFloat((mPercent * goalWeight).toFixed(4));

        pmsRows.push({
          month: m,
          number: number++,
          goal: buildPmsGoalLabel(task, projectMap[task.project_id]?.name),
          kpi: PMS_DEFAULT_KPI,
          ratings: PMS_DEFAULT_RATINGS,
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
      months,
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
