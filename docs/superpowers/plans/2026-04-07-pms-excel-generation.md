# PMS Excel Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Generate PMS" option to each employee card on the Global Team Performance page that produces an AI-assisted, formatted Excel report matching the reference PMS format.

**Architecture:** A 3-dot menu on each `WorkspaceTeamProgress` card opens a modal; user picks year/quarter; frontend POSTs to a new `/api/ai/generate_pms` endpoint; server fetches tasks (where employee is assignee or project lead), sends them to Gemini for goal weights + enriched text, computes scores server-side, builds an Excel file with `exceljs`, and streams it back as a download.

**Tech Stack:** React (TSX), Zustand, exceljs (new), @google/generative-ai (existing), Supabase (existing), Express (existing)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `exceljs` dependency |
| `server/pmsExcel.js` | **Create** | Build the .xlsx workbook from structured PMS data |
| `server/routes/ai.js` | Modify | Add `POST /generate_pms` handler |
| `src/lib/api.ts` | Modify | Add `api.ai.generatePms` method (returns Blob) |
| `src/components/WorkspaceTeamProgress.tsx` | Modify | Add 3-dot menu + PMS modal UI |

---

## Task 1: Install exceljs

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install exceljs
```

Expected output: `added N packages` with no errors. `exceljs` appears in `package.json` dependencies.

- [ ] **Step 2: Verify import works**

```bash
node -e "import('exceljs').then(m => console.log('exceljs OK:', typeof m.default))"
```

Expected: `exceljs OK: function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add exceljs for PMS Excel generation"
```

---

## Task 2: Create server/pmsExcel.js

**Files:**
- Create: `server/pmsExcel.js`

This module takes structured PMS data and returns an Excel buffer. No Supabase, no AI — pure data → Excel.

**Data shape it receives:**
```js
{
  employee: { name, position, businessUnit },
  year: 2025,
  quarter: 2,
  quarterLabel: 'April 01 - June 30, 2025',
  months: ['April', 'May', 'June'],
  // monthSummary: { April: { finalScore, rating }, May: {...}, June: {...} }
  monthSummary: { April: { finalScore: 0.95, rating: 1 }, ... },
  // rows: one per task, ordered by month then number
  rows: [
    {
      month: 'April',
      number: 1,
      goal: 'Set up enrollment module database: ...',
      kpi: '>=N ( 100% average completion per month)',
      ratings: '1 - > 2 (93% - 100% Progress Rate, Zero Delay);\n...',
      target: 1,
      actual: 1.0,
      mPercent: 1.0,
      goalWeight: 0.12,
      finalScore: 0.12,
    },
    ...
  ]
}
```

- [ ] **Step 1: Create server/pmsExcel.js**

```js
import ExcelJS from 'exceljs';

const RATING_SCALE = [
  { rating: 1, min: 0.95 },
  { rating: 2, min: 0.90 },
  { rating: 3, min: 0.80 },
  { rating: 4, min: 0.75 },
  { rating: 5, min: 0 },
];

export function scoreToRating(score) {
  for (const { rating, min } of RATING_SCALE) {
    if (score >= min) return rating;
  }
  return 5;
}

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
const COL_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
const COL_HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const LABEL_FONT = { bold: true, size: 10 };
const THIN_BORDER = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
};

function styleHeaderCell(cell, label) {
  cell.value = label;
  cell.font = LABEL_FONT;
  cell.fill = HEADER_FILL;
  cell.border = THIN_BORDER;
  cell.alignment = { vertical: 'middle', wrapText: false };
}

function styleValueCell(cell, value) {
  cell.value = value;
  cell.border = THIN_BORDER;
  cell.alignment = { vertical: 'middle', wrapText: false };
}

export async function buildPMSExcel({ employee, year, quarter, quarterLabel, months, monthSummary, rows }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Project Delight Gantt';
  wb.created = new Date();

  // ── Main sheet: named after employee (max 31 chars) ─────────
  const sheetName = (employee.name || 'Employee').substring(0, 31);
  const ws = wb.addWorksheet(sheetName);

  // Column widths: A(empty) B(MONTH) C(NUMBER) D(GOAL) E(KPI) F(RATINGS) G(TARGET) H(ACTUAL) I(M%) J(GOAL WEIGHT) K(FINAL SCORE)
  ws.columns = [
    { key: 'A', width: 3 },
    { key: 'B', width: 14 },
    { key: 'C', width: 8 },
    { key: 'D', width: 62 },
    { key: 'E', width: 36 },
    { key: 'F', width: 52 },
    { key: 'G', width: 10 },
    { key: 'H', width: 10 },
    { key: 'I', width: 10 },
    { key: 'J', width: 14 },
    { key: 'K', width: 14 },
  ];

  // ── Header block (rows 2–5) ──────────────────────────────────
  // Row 2: NAME | [name] | PERFORMANCE YEAR | [year] | MONTH | FINAL SCORE | FINAL RATING
  const r2 = ws.getRow(2);
  styleHeaderCell(r2.getCell('B'), 'NAME');
  styleValueCell(r2.getCell('D'), employee.name || '');
  styleHeaderCell(r2.getCell('E'), 'PERFORMANCE YEAR');
  styleValueCell(r2.getCell('F'), year);
  styleHeaderCell(r2.getCell('H'), 'MONTH');
  styleHeaderCell(r2.getCell('I'), 'FINAL SCORE');
  styleHeaderCell(r2.getCell('J'), 'FINAL RATING');
  r2.commit();

  // Row 3: POSITION | [position] | EVALUATION DATE | [quarterLabel] | [month1] | [score1] | [rating1]
  const r3 = ws.getRow(3);
  styleHeaderCell(r3.getCell('B'), 'POSITION');
  styleValueCell(r3.getCell('D'), employee.position || '');
  styleHeaderCell(r3.getCell('E'), 'EVALUATION DATE');
  styleValueCell(r3.getCell('F'), quarterLabel);
  styleValueCell(r3.getCell('H'), months[0] || '');
  styleValueCell(r3.getCell('I'), monthSummary[months[0]]?.finalScore ?? '');
  styleValueCell(r3.getCell('J'), monthSummary[months[0]]?.rating ?? '');
  r3.commit();

  // Row 4: IMMEDIATE HEAD | (empty) | SUBMISSION DATE | (empty) | [month2] | [score2] | [rating2]
  const r4 = ws.getRow(4);
  styleHeaderCell(r4.getCell('B'), 'IMMEDIATE HEAD');
  styleValueCell(r4.getCell('D'), '');
  styleHeaderCell(r4.getCell('E'), 'SUBMISSION DATE');
  styleValueCell(r4.getCell('F'), '');
  styleValueCell(r4.getCell('H'), months[1] || '');
  styleValueCell(r4.getCell('I'), monthSummary[months[1]]?.finalScore ?? '');
  styleValueCell(r4.getCell('J'), monthSummary[months[1]]?.rating ?? '');
  r4.commit();

  // Row 5: COMPANY | [businessUnit] | Unit | [businessUnit] | [month3] | [score3] | [rating3]
  const r5 = ws.getRow(5);
  styleHeaderCell(r5.getCell('B'), 'COMPANY');
  styleValueCell(r5.getCell('D'), employee.businessUnit || '');
  styleHeaderCell(r5.getCell('E'), 'Unit');
  styleValueCell(r5.getCell('F'), employee.businessUnit || '');
  styleValueCell(r5.getCell('H'), months[2] || '');
  styleValueCell(r5.getCell('I'), monthSummary[months[2]]?.finalScore ?? '');
  styleValueCell(r5.getCell('J'), monthSummary[months[2]]?.rating ?? '');
  r5.commit();

  // ── Row 7: Column headers ────────────────────────────────────
  const r7 = ws.getRow(7);
  ['B','C','D','E','F','G','H','I','J','K'].forEach((col, idx) => {
    const labels = ['MONTH','NUMBER','GOAL','KPI','RATINGS','TARGET','ACTUAL','M%','GOAL WEIGHT','FINAL SCORE'];
    const cell = r7.getCell(col);
    cell.value = labels[idx];
    cell.font = COL_HEADER_FONT;
    cell.fill = COL_HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
  });
  r7.height = 20;
  r7.commit();

  // ── Data rows (row 8 onwards) ────────────────────────────────
  const MONTH_FILLS = [
    { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } },
    { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF9F0' } },
    { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } },
  ];

  let currentRow = 8;
  let lastMonth = null;
  let monthColorIdx = -1;

  for (const row of rows) {
    if (row.month !== lastMonth) {
      if (lastMonth !== null) {
        // blank separator row between months
        currentRow++;
      }
      lastMonth = row.month;
      monthColorIdx = (monthColorIdx + 1) % MONTH_FILLS.length;
    }

    const monthFill = MONTH_FILLS[monthColorIdx];
    const r = ws.getRow(currentRow);

    const setCellData = (col, value, opts = {}) => {
      const cell = r.getCell(col);
      cell.value = value;
      cell.border = THIN_BORDER;
      cell.fill = monthFill;
      cell.alignment = { vertical: 'middle', wrapText: !!opts.wrap, horizontal: opts.center ? 'center' : 'left' };
      if (opts.numFmt) cell.numFmt = opts.numFmt;
    };

    setCellData('B', row.month);
    setCellData('C', row.number, { center: true });
    setCellData('D', row.goal, { wrap: true });
    setCellData('E', row.kpi, { wrap: true });
    setCellData('F', row.ratings, { wrap: true });
    setCellData('G', row.target, { numFmt: '0.00', center: true });
    setCellData('H', row.actual, { numFmt: '0.00', center: true });
    setCellData('I', row.mPercent, { numFmt: '0.00', center: true });
    setCellData('J', row.goalWeight, { numFmt: '0.00', center: true });
    setCellData('K', row.finalScore, { numFmt: '0.00', center: true });

    r.height = 60;
    r.commit();
    currentRow++;
  }

  // ── Settings sheet ───────────────────────────────────────────
  const sws = wb.addWorksheet('Settings');
  sws.columns = [{ width: 5 }, { width: 10 }, { width: 10 }, { width: 10 }];
  const settingsData = [
    [1, 0.95, 1],
    [2, 0.90, 0.94],
    [3, 0.80, 0.89],
    [4, 0.75, 0.79],
    [5, null, 0.74],
  ];
  settingsData.forEach((rowData, i) => {
    const sr = sws.getRow(i + 4);
    sr.getCell('B').value = rowData[0];
    sr.getCell('C').value = rowData[1];
    sr.getCell('D').value = rowData[2];
    sr.commit();
  });

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/pmsExcel.js
git commit -m "feat: add pmsExcel builder (exceljs)"
```

---

## Task 3: Add POST /generate_pms to server/routes/ai.js

**Files:**
- Modify: `server/routes/ai.js`

This endpoint:
1. Validates request body
2. Resolves employee info
3. Fetches and filters tasks from Supabase
4. Calls Gemini for weights + enriched text
5. Computes actual/M%/finalScore server-side
6. Calls `buildPMSExcel` and streams back the buffer

- [ ] **Step 1: Add imports at top of server/routes/ai.js**

After the existing imports, add:

```js
import { supabaseAdmin } from '../db.js';
import { requireUser } from '../middleware/auth.js';
import { buildPMSExcel, scoreToRating } from '../pmsExcel.js';
```

- [ ] **Step 2: Add quarter helpers after the imports**

Add this block right after the imports, before `const router = Router();`:

```js
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
  // fallback: assign to closest month
  return months[months.length - 1];
}

function isEmailMatch(email, employeeEmail, companyEmail, personalEmail) {
  const norm = (v) => (v || '').toLowerCase().trim();
  const e = norm(email);
  return e && (e === norm(employeeEmail) || e === norm(companyEmail) || e === norm(personalEmail));
}

function isLeadMatch(lead, employeeId, employeeEmail, companyEmail, personalEmail) {
  if (!lead) return false;
  const idMatch = lead.toLowerCase().match(/^id:(\d+)$/) || lead.match(/^(\d+)$/);
  if (idMatch) return parseInt(idMatch[1], 10) === employeeId;
  return isEmailMatch(lead, employeeEmail, companyEmail, personalEmail);
}
```

- [ ] **Step 3: Add the generate_pms route at the end of server/routes/ai.js (before `export default router`)**

```js
router.post('/generate_pms', requireUser, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'GEMINI_API_KEY is missing.' });

    const { employeeEmail, employeeId, employeeName, employeePosition, employeeBusinessUnit, year, quarter } = req.body;
    if (!employeeEmail || !year || !quarter) {
      return res.status(400).json({ error: 'Missing employeeEmail, year, or quarter.' });
    }

    const { start, end, months } = getQuarterDateRange(year, quarter);
    const quarterLabel = `${months[0]} 01 - ${months[2]} ${end.getDate()}, ${year}`;

    // ── Fetch all projects and tasks ─────────────────────────
    const { data: allProjects, error: projErr } = await supabaseAdmin.from('projects').select('*');
    if (projErr) return res.status(500).json({ error: projErr.message });

    const { data: allTasks, error: taskErr } = await supabaseAdmin
      .from('tasks')
      .select('id, project_id, title, start_date, end_date, duration, progress, assignee, is_summary, parent_id');
    if (taskErr) return res.status(500).json({ error: taskErr.message });

    // ── Identify lead projects ───────────────────────────────
    const leadProjectIds = new Set(
      allProjects
        .filter(p => isLeadMatch(p.lead, employeeId, employeeEmail, null, null))
        .map(p => p.id)
    );

    // ── Filter tasks: assignee OR in a lead project, non-summary only ─
    const candidateTasks = allTasks.filter(t => {
      if (t.is_summary) return false;
      const isAssignee = isEmailMatch(t.assignee, employeeEmail, null, null);
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
      const m = taskMonthName(t.end_date, year, quarter);
      tasksByMonth[m].push(t);
    }

    // Remove empty months
    for (const m of months) {
      if (tasksByMonth[m].length === 0) delete tasksByMonth[m];
    }

    const activeMonths = months.filter(m => tasksByMonth[m]);

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

      monthSummary[m] = {
        finalScore: parseFloat(monthTotal.toFixed(4)),
        rating: scoreToRating(monthTotal),
      };
    }

    // ── Build Excel ──────────────────────────────────────────
    const buffer = await buildPMSExcel({
      employee: {
        name: employeeName,
        position: employeePosition || '',
        businessUnit: employeeBusinessUnit || '',
      },
      year,
      quarter,
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
```

- [ ] **Step 4: Verify the server starts without errors**

```bash
npm run dev
```

Look for: no import errors, server starts on port 3001. Check console for `[PMS]` or syntax errors.

- [ ] **Step 5: Commit**

```bash
git add server/routes/ai.js
git commit -m "feat: add POST /ai/generate_pms endpoint"
```

---

## Task 4: Add api.ai.generatePms to src/lib/api.ts

**Files:**
- Modify: `src/lib/api.ts`

The PMS endpoint returns binary data (a `.xlsx` file), not JSON — so it cannot use the existing `req<T>` helper. We add a dedicated method that returns a `Blob`.

- [ ] **Step 1: Add generatePms to the ai object inside src/lib/api.ts**

Locate the `ai:` block (currently ends at line ~210):

```typescript
  ai: {
    generateUpdate: (data: {
      project: Pick<DBProject, 'name' | 'start_date' | 'id'>;
      currentTasks: any[];
      context: string;
    }) =>
      req<{ operations: any[] }>('/ai/generate_update', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
```

Replace it with:

```typescript
  ai: {
    generateUpdate: (data: {
      project: Pick<DBProject, 'name' | 'start_date' | 'id'>;
      currentTasks: any[];
      context: string;
    }) =>
      req<{ operations: any[] }>('/ai/generate_update', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    generatePms: async (data: {
      employeeEmail: string;
      employeeId?: number | null;
      employeeName: string;
      employeePosition?: string | null;
      employeeBusinessUnit?: string | null;
      year: number;
      quarter: 1 | 2 | 3 | 4;
    }): Promise<Blob> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const devUserEmail =
        typeof window !== 'undefined' ? window.sessionStorage.getItem('user_email') : null;
      if (!import.meta.env.PROD && devUserEmail) headers['x-user-email'] = devUserEmail;

      const res = await fetch(`${BASE}/ai/generate_pms`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      return res.blob();
    },
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add api.ai.generatePms (returns Blob for download)"
```

---

## Task 5: Add 3-dot menu and PMS modal to WorkspaceTeamProgress

**Files:**
- Modify: `src/components/WorkspaceTeamProgress.tsx`

This is the largest UI change. We add:
1. State for open menu and modal
2. A `⋮` button on each card (top-right, visible on hover)
3. A dropdown menu with "Generate PMS"
4. A modal for year/quarter selection + loading/error states
5. The download trigger on success

- [ ] **Step 1: Add imports at top of WorkspaceTeamProgress.tsx**

After the existing imports, add:

```typescript
import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
```

- [ ] **Step 2: Add state and handlers inside the WorkspaceTeamProgress function, after the existing useMemo blocks**

Add this block right before the `return (` statement:

```typescript
  // ── PMS state ─────────────────────────────────────────────
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [pmsTarget, setPmsTarget] = useState<{
    key: string; name: string; email: string; employeeId?: number | null;
    position?: string; businessUnit?: string;
  } | null>(null);
  const [pmsYear, setPmsYear] = useState<number>(new Date().getFullYear());
  const [pmsQuarter, setPmsQuarter] = useState<1 | 2 | 3 | 4>(
    Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4
  );
  const [pmsLoading, setPmsLoading] = useState(false);
  const [pmsError, setPmsError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuKey) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuKey(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuKey]);

  const handleGeneratePms = async () => {
    if (!pmsTarget) return;
    setPmsLoading(true);
    setPmsError(null);
    try {
      const blob = await api.ai.generatePms({
        employeeEmail: pmsTarget.email,
        employeeId: pmsTarget.employeeId ?? null,
        employeeName: pmsTarget.name,
        employeePosition: pmsTarget.position ?? null,
        employeeBusinessUnit: pmsTarget.businessUnit ?? null,
        year: pmsYear,
        quarter: pmsQuarter,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = pmsTarget.name.replace(/\s+/g, '');
      a.href = url;
      a.download = `PMS_${pmsYear}_Q${pmsQuarter}_${safeName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setPmsTarget(null);
    } catch (err: any) {
      setPmsError(err.message || 'Generation failed.');
    } finally {
      setPmsLoading(false);
    }
  };
```

- [ ] **Step 3: Replace the card JSX inside the `.map(s => ...)` in WorkspaceTeamProgress.tsx**

Find this line:
```tsx
        <div key={s.key} className="card-premium cursor-pointer p-5 transition-all group overflow-hidden relative border-none!">
```

Replace the entire card `<div>` (from `<div key={s.key}` through its closing `</div>`) with:

```tsx
          <div key={s.key} className="card-premium p-5 transition-all group overflow-hidden relative border-none!">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />

            {/* 3-dot menu */}
            <div className="absolute top-3 right-3 z-10" ref={openMenuKey === s.key ? menuRef : undefined}>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenMenuKey(openMenuKey === s.key ? null : s.key); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Options"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                </svg>
              </button>
              {openMenuKey === s.key && (
                <div className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                  <button
                    onClick={() => {
                      setOpenMenuKey(null);
                      setPmsError(null);
                      setPmsTarget({
                        key: s.key,
                        name: s.name,
                        email: s.email,
                        employeeId: systemUsers.find(u =>
                          [u.email, u.company_email_add, u.personal_email_add]
                            .some(e => e?.toLowerCase() === s.email?.toLowerCase())
                        )?.employee_id ?? null,
                        position: s.position !== 'Not set' ? s.position : undefined,
                        businessUnit: s.businessUnit !== 'Not set' ? s.businessUnit : undefined,
                      });
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate PMS
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mb-5 relative">
              <UserAvatar
                email={s.email || undefined}
                name={s.name}
                size="lg"
                activeColor="#6366f1"
                className="ring-4 ring-slate-50 border border-slate-100"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-slate-900 truncate tracking-tight">{s.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{s.projectCount} Projects Joined</p>
                </div>
                {s.unresolvedLead && (
                  <p className="text-[10px] text-amber-600 mt-1 truncate">Unresolved lead: {s.unresolvedLead}</p>
                )}
              </div>
            </div>

            <div className="mb-4 space-y-1">
              <p className="text-[10px] text-slate-500 truncate"><span className="font-semibold text-slate-600">BU:</span> {s.businessUnit}</p>
              <p className="text-[10px] text-slate-500 truncate"><span className="font-semibold text-slate-600">Dept:</span> {s.department}</p>
              <p className="text-[10px] text-slate-500 truncate"><span className="font-semibold text-slate-600">Position:</span> {s.position}</p>
            </div>

            <div className="space-y-4 relative">
              <div className="flex items-end justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cross-App Avg.</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{s.avgProgress}</span>
                  <span className="text-xs font-bold text-slate-400 font-mono">%</span>
                </div>
              </div>

              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${s.avgProgress}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/30 group-hover:bg-blue-50 transition-colors text-center">
                  <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-1">Total Tasks</p>
                  <p className="text-lg font-bold text-blue-700 tracking-tight">{s.total}</p>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/30 group-hover:bg-emerald-50 transition-colors text-center">
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Done</p>
                  <p className="text-lg font-bold text-emerald-700 tracking-tight">{s.completed}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Global Integrity</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`h-1 w-1 rounded-full ${s.pending === 0 ? 'bg-emerald-500' : 'bg-blue-400'}`} />
                  <span className="text-[10px] font-bold text-slate-500">
                    {s.pending === 0 ? 'Fully Synchronized' : `${s.pending} active nodes`}
                  </span>
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </div>
          </div>
```

- [ ] **Step 4: Add the PMS modal just before the closing `</div>` of the component's return**

Find the last `</div>` in the return block (the one that closes `<div className="w-full space-y-8 animate-fade-in">`), and insert the modal just before it:

```tsx
      {/* PMS Generation Modal */}
      {pmsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-slate-800">Generate PMS Report</h3>
              <button
                onClick={() => { if (!pmsLoading) setPmsTarget(null); }}
                className="h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500">Employee</p>
              <p className="text-sm font-semibold text-slate-800">{pmsTarget.name}</p>
              {pmsTarget.position && <p className="text-xs text-slate-500">{pmsTarget.position}</p>}
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Performance Year</label>
                <input
                  type="number"
                  value={pmsYear}
                  onChange={e => setPmsYear(Number(e.target.value))}
                  min={2020}
                  max={2099}
                  disabled={pmsLoading}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Quarter</label>
                <div className="grid grid-cols-4 gap-2">
                  {([1, 2, 3, 4] as const).map(q => (
                    <button
                      key={q}
                      onClick={() => setPmsQuarter(q)}
                      disabled={pmsLoading}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                        pmsQuarter === q
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                      } disabled:opacity-50`}
                    >
                      Q{q}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {['Jan–Mar','Apr–Jun','Jul–Sep','Oct–Dec'][pmsQuarter - 1]}
                </p>
              </div>
            </div>

            {pmsError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs text-red-600">{pmsError}</p>
              </div>
            )}

            <button
              onClick={handleGeneratePms}
              disabled={pmsLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {pmsLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Generating...
                </>
              ) : 'Generate & Download'}
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/WorkspaceTeamProgress.tsx src/lib/api.ts
git commit -m "feat: add PMS 3-dot menu and generation modal to team cards"
```

---

## Task 6: End-to-end manual test

**Files:** None modified — verification only.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: frontend on `http://localhost:5173`, backend on `http://localhost:3001`. No console errors.

- [ ] **Step 2: Navigate to Global Team Performance**

Open `http://localhost:5173`, sign in, go to the Projects page, click the "Team Overview" tab.

Expected: employee cards load. On hover, a `⋮` button appears top-right of each card.

- [ ] **Step 3: Test the dropdown**

Click the `⋮` button on any employee card.

Expected: a dropdown appears with "Generate PMS". Click anywhere outside — dropdown closes.

- [ ] **Step 4: Open the modal**

Click "Generate PMS".

Expected: modal appears showing employee name + position. Year defaults to current year. Quarter buttons show Q1–Q4. Current quarter is pre-selected.

- [ ] **Step 5: Generate a report**

Select a year and quarter where the employee has tasks (check the Gantt to confirm). Click "Generate & Download".

Expected: spinner shows, then a `.xlsx` file downloads named `PMS_{year}_Q{quarter}_{Name}.xlsx`.

- [ ] **Step 6: Open the downloaded Excel**

Open the file in Excel or LibreOffice.

Verify:
- Sheet name = employee's full name
- Header block rows 2–5 have NAME, POSITION, COMPANY, PERFORMANCE YEAR, EVALUATION DATE
- Row 7 has column headers: MONTH, NUMBER, GOAL, KPI, RATINGS, TARGET, ACTUAL, M%, GOAL WEIGHT, FINAL SCORE
- Data rows appear grouped by month with blank separators
- GOAL column has expanded, professional descriptions
- TARGET = 1.00, ACTUAL = task progress / 100, M% = ACTUAL/TARGET, GOAL WEIGHT sums to ~1.0 per month, FINAL SCORE = M% × GOAL WEIGHT
- Settings sheet present with rating scale

- [ ] **Step 7: Test error case**

Select a year/quarter where the employee has no tasks (e.g., a future quarter).

Expected: modal shows red error message "No tasks found for this employee in the selected period."

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: PMS Excel generation complete — AI weights, exceljs output, card menu"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 3-dot menu on employee card (top-right, hover) → Task 5 Step 3
- ✅ "Generate PMS" button in dropdown → Task 5 Step 3
- ✅ Year + quarter modal → Task 5 Step 4
- ✅ Tasks from assignee + lead projects → Task 3 Step 3
- ✅ AI assigns goal weights (Gemini prompt) → Task 3 Step 3
- ✅ Server computes actual/M%/finalScore → Task 3 Step 3
- ✅ Excel sheet name = employee name → Task 2 Step 1
- ✅ Header block (NAME, POSITION, COMPANY=BU, IMMEDIATE HEAD empty) → Task 2 Step 1
- ✅ Settings sheet with rating scale → Task 2 Step 1
- ✅ Filename: `PMS_{year}_Q{quarter}_{Name}.xlsx` → Task 5 Step 2
- ✅ Error when no tasks found → Task 3 Step 3 + Task 6 Step 7
- ✅ `exceljs` dependency → Task 1

**Placeholder scan:** No TBDs or "implement later" found.

**Type consistency:**
- `generatePms` in `api.ts` matches the call in `WorkspaceTeamProgress.tsx` — same field names
- `buildPMSExcel` params in `pmsExcel.js` match the call in `ai.js`
- `scoreToRating` defined in `pmsExcel.js`, imported in `ai.js`
- `pmsRows` structure built in `ai.js` matches what `buildPMSExcel` consumes
