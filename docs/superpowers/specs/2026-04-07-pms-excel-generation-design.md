# PMS Excel Report Generation — Design Spec
**Date:** 2026-04-07
**Status:** Approved

---

## Overview

Add AI-powered PMS (Performance Management System) Excel report generation to the Global Team Performance page. Each employee card gets a 3-dot menu with a "Generate PMS" option that produces an Excel file matching the reference format (`PMS 2025_QMD_Q2 Jonald Penpillo 2.xlsx`).

---

## Approach

**Hybrid (Approach B):** AI assigns goal weights and enriches text; server computes all numeric scores deterministically.

- AI (Gemini 2.0 Flash) handles: goal weight assignment per task, enriched goal descriptions, KPI text, ratings rubric text
- Server handles: actual = progress/100, target = 1.0, M% = actual/target, final_score = M% × goal_weight
- Excel generated server-side with `exceljs`

---

## 1. UI Changes

### WorkspaceTeamProgress Employee Card
- Add a `⋮` (3-dot) icon button at top-right of each card, visible on hover
- Clicking opens a small dropdown with one item: **"Generate PMS"**
- Implemented via a local `isMenuOpen` state per card (no global state needed)
- Click outside closes the menu

### PMS Generation Modal
- Triggered by clicking "Generate PMS" from the 3-dot menu
- Fields:
  - Employee name (read-only display)
  - Year (number input, default = current year)
  - Quarter (radio or select: Q1/Q2/Q3/Q4 with month labels)
- "Generate" button → loading spinner while processing
- On success: file auto-downloads, modal closes
- On error: inline error message shown

---

## 2. Data Layer

### New Server Endpoint
`POST /api/ai/generate_pms`

**Request body:**
```json
{
  "employeeEmail": "jonald@company.com",
  "employeeId": 12345,
  "year": 2025,
  "quarter": 2
}
```

**Server logic:**
1. Determine quarter months: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
2. Fetch all projects from Supabase
3. Identify projects where `project.lead` resolves to the employee (match by email or `id:NNNN` format)
4. Fetch all tasks across ALL projects
5. Collect tasks where `task.assignee` matches employee email (any project)
6. Collect tasks from lead projects (all non-summary tasks)
7. Merge + deduplicate by task ID
8. Filter: task's `end_date` falls within the quarter's date range (or overlaps a quarter month)
9. Group tasks by month (month of `end_date`)
10. Pass to AI + compute scores + generate Excel

**Response:** Binary `.xlsx` file with headers:
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="PMS_{year}_Q{quarter}_{EmployeeName}.xlsx"
```

---

## 3. AI Integration

### New AI endpoint logic (added to `server/routes/ai.js`)

**Gemini prompt input:**
```json
{
  "employee": {
    "name": "Jonald D. Penpillo",
    "position": "Junior Software Developer",
    "business_unit": "DMS Unit"
  },
  "year": 2025,
  "quarter": 2,
  "quarterLabel": "April 01 - June 30, 2025",
  "tasksByMonth": {
    "April": [
      {
        "id": "task-uuid",
        "title": "Set up enrollment module database",
        "progress": 100,
        "start_date": "2025-04-01",
        "end_date": "2025-04-05",
        "duration": 5
      }
    ],
    "May": [...],
    "June": [...]
  }
}
```

**Gemini instructions:**
- For each task, return:
  - `goal`: Expanded professional description (task title + context sentence explaining business value)
  - `kpi`: Standard text `>=N ( 100% average completion per month)`
  - `ratings`: Standard rubric text (5-tier: based on % progress rate and delay days)
  - `goal_weight`: Float 0.01–1.0; weights across all tasks in a month must sum exactly to 1.0
- Weight assignment guidance: heavier tasks (longer duration, more complex titles) get higher weights; short/simple tasks get lower weights
- Return JSON only, no markdown

**Server post-processing (after AI response):**
```
actual      = task.progress / 100
target      = 1.0
m_percent   = actual / target
final_score = m_percent × goal_weight
```

**Monthly summary:**
```
month_final_score = sum(final_score for all tasks in month)
month_rating      = lookup from Settings scale:
                    ≥0.95 → 1, 0.90-0.94 → 2, 0.80-0.89 → 3, 0.75-0.79 → 4, <0.75 → 5
```

---

## 4. Excel Generation

**Package:** `exceljs` (supports cell styles, merged cells, borders, colors)

### Sheet Structure

**Sheet name:** Employee full name (e.g., `"Jonald D. Penpillo"`)

**Header block (rows 2–5):**
| Row | Col B | Col C | Col D | Col E | Col F | Col H | Col I | Col J |
|-----|-------|-------|-------|-------|-------|-------|-------|-------|
| 2 | NAME | | [name] | PERFORMANCE YEAR | [year] | MONTH | FINAL SCORE | FINAL RATING |
| 3 | POSITION | | [position] | EVALUATION DATE | [quarter range] | [month 1] | [score] | [rating] |
| 4 | IMMEDIATE HEAD | | _(empty)_ | SUBMISSION DATE | _(empty)_ | [month 2] | [score] | [rating] |
| 5 | COMPANY | | [business_unit] | Unit | [unit] | [month 3] | [score] | [rating] |

**Row 7 — Column headers:**
`MONTH | NUMBER | GOAL | KPI | RATINGS | TARGET | ACTUAL | M% | GOAL WEIGHT | FINAL SCORE`

**Rows 8+ — Data rows:**
- One row per task
- Blank separator row between months
- Columns match the header exactly

**Settings sheet:**
| Rating | Upper | Lower |
|--------|-------|-------|
| 1 | 0.95 | 1 |
| 2 | 0.90 | 0.94 |
| 3 | 0.80 | 0.89 |
| 4 | 0.75 | 0.79 |
| 5 | — | 0.74 |

### Styling
- Header block: bold labels, light gray fill
- Column header row: bold, blue background, white text
- Alternating row shading per month group
- Number columns (TARGET, ACTUAL, M%, GOAL WEIGHT, FINAL SCORE): 2 decimal places
- Column widths: GOAL and RATINGS columns wide (60+), others standard

---

## 5. Full Flow

```
1. User → Global Team Performance tab (ProjectsPage)
2. Hover employee card → ⋮ button appears top-right
3. Click ⋮ → dropdown: "Generate PMS"
4. PMS Modal opens: shows employee name, year input, quarter selector
5. User selects year + quarter → clicks "Generate"
6. Frontend: POST /api/ai/generate_pms { employeeEmail, employeeId, year, quarter }
7. Server:
   a. Resolve employee from email/id
   b. Fetch & filter tasks (assignee + lead projects, quarter date range)
   c. Group tasks by month
   d. Call Gemini → get weights + enriched text
   e. Compute actual/m%/final_score server-side
   f. Build Excel with exceljs (header block, data rows, settings sheet)
   g. Return binary .xlsx response
8. Frontend: receive blob → trigger browser download
   Filename: PMS_{year}_Q{quarter}_{EmployeeName}.xlsx
9. Modal closes (or shows success state)
```

---

## 6. New Files & Changes

| File | Change |
|------|--------|
| `src/components/WorkspaceTeamProgress.tsx` | Add 3-dot menu + PMS modal |
| `server/routes/ai.js` | Add `POST /ai/generate_pms` handler |
| `server/pmsExcel.js` | New: Excel builder using exceljs |
| `package.json` | Add `exceljs` dependency |

No new frontend routes. No new database tables. No changes to existing task/project data models.

---

## 7. Constraints & Assumptions

- Tasks with no `end_date` in the quarter are excluded
- Tasks assigned to "Unassigned" are excluded
- If a task spans multiple months, it is assigned to the month of its `end_date`
- If an employee has no tasks for a given quarter, the modal shows an error: "No tasks found for this employee in the selected period"
- Immediate Head and Submission Date fields are left empty in the Excel (per user decision)
- Company field = business_unit value from employee record
- `exceljs` is added as a server-side dependency only
