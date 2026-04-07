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
