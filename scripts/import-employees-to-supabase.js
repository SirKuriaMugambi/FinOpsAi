const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const officeCrypto = require('officecrypto-tool');

const workspaceRoot = path.resolve(__dirname, '..');
const workbookPath = path.join(workspaceRoot, 'reference-data', 'CA- AI Payroll automation project.xlsx');
const envPath = path.join(workspaceRoot, '.env.local');

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .reduce((acc, line) => {
      const idx = line.indexOf('=');
      if (idx > -1) {
        acc[line.slice(0, idx)] = line.slice(idx + 1);
      }
      return acc;
    }, {});
}

function normalizeNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function toCurrencyNumber(value) {
  return Number(normalizeNumber(value).toFixed(2));
}

function buildNationalId(staffNo, rowIndex) {
  const safe = String(staffNo || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  // Always fold in the row index so two rows that both lack a staff number
  // can never generate the same national_id and collide on insert.
  return `NID-${safe || 'R' + rowIndex}`.slice(0, 24);
}

// Words/phrases that indicate a row is a totals/header/label row, not a real employee.
// Matched as an EXACT (whole-field) match only, never a substring, so we don't
// accidentally reject real data that happens to contain one of these words.
const JUNK_KEYWORDS = [
  'total', 'totals', 'grand total', 'subtotal',
  'part time', 'production-511', 'category', 'department',
  'staff no', 'name', 'pin no', 'basic', 'gross', 'net pay',
];

function isJunkRow({ staffNo, rawName, kraPin }) {
  const staffLower = String(staffNo || '').trim().toLowerCase();
  const nameLower = String(rawName || '').trim().toLowerCase();
  const pinLower = String(kraPin || '').trim().toLowerCase();

  // Flag only exact matches to a known junk keyword in id, name, or pin fields.
  // We deliberately do NOT validate KRA PIN format here real PINs in this sheet
  // don't reliably follow the textbook pattern, and rejecting on format caused
  // real employees to be wrongly skipped.
  if (JUNK_KEYWORDS.some((kw) => staffLower === kw || nameLower === kw || pinLower === kw)) {
    return true;
  }

  return false;
}

// A real name has at least one letter in it. Pure numbers, currency figures,
// or blank strings are not names.
function isRealName(value) {
  const v = String(value || '').trim();
  return v.length > 0 && /[A-Za-z]/.test(v);
}

// Matches things like "30,313.94" or "1,200" — a number formatted as
// currency/thousands, which indicates a salary figure leaked into a
// text column rather than being a real staff number or name.
function isCurrencyLike(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  return /^[\d,]+(\.\d+)?$/.test(v) && (v.includes(',') || v.includes('.'));
}

function extractEmployeeId(row, staffIndex, nameIndex) {
  const staffCandidate = String(row[staffIndex] ?? '').trim();
  const nameCandidate = String(row[nameIndex] ?? '').trim();

  // ALWAYS prefer the Staff No column when it has a value — this is the
  // sheet's real employee identifier (1-49 in Tony's sheet). Some rows'
  // "Name" column happens to contain a legacy/secondary numeric code
  // (e.g. "1000") rather than a person's name, which used to get
  // mistakenly picked as the ID instead. Only fall back to the Name
  // column's value if Staff No is genuinely blank.
  if (staffCandidate) {
    return staffCandidate;
  }

  if (nameCandidate) {
    return nameCandidate;
  }

  return '';
}

async function main() {
  const env = parseEnvFile(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const workbookBuffer = fs.readFileSync(workbookPath);
  const decryptedBuffer = await officeCrypto.decrypt(workbookBuffer, { password: '8489' });
  const workbook = XLSX.read(decryptedBuffer, { type: 'buffer' });
  const sheetName = 'Integrating with AX cost center';
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Sheet ${sheetName} not found in workbook.`);
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const headerIndex = rows.findIndex((row) => Array.isArray(row) && row.includes('Staff No'));
  if (headerIndex === -1) {
    throw new Error('Unable to locate the employee header row in the workbook.');
  }

  const header = rows[headerIndex].map((cell) => String(cell ?? '').trim());
  // CONFIRMED (cell-by-cell, cross-checked with openpyxl independently of
  // this SheetJS parse): the header row's "Staff No"/"Name" labels are
  // shifted one column left of the real data in this specific workbook.
  // The column literally labeled "Staff No" holds a throwaway sequence
  // number (1, 2, 3, ...49); the REAL staff number (1000-1049) is one
  // column over, in the column labeled "Name" — and there is no actual
  // employee-name column anywhere in this sheet (consistent with the data
  // being anonymized for this pilot). Swapped explicitly rather than via
  // header-text lookup, which would silently reproduce the mislabeling.
  const staffIndex = header.findIndex((cell) => cell === 'Name');
  const nameIndex = -1; // no real name column exists in this sheet — always placeholder
  const pinIndex = header.findIndex((cell) => cell === 'Pin No');
  const basicIndex = header.findIndex((cell) => cell.includes('Basic'));
  const bonusIndex = header.findIndex((cell) => cell.includes('Bonus/Comm'));
  const fringeIndex = header.findIndex((cell) => cell.includes('Fringe benefit'));
  const transportIndex = header.findIndex((cell) => cell.includes('Transport/Hse Allowance'));
  const arrearsIndex = header.findIndex((cell) => cell.includes('Arrears'));
  const othersIndex = header.findIndex((cell) => cell.includes('Salary Arrears/OT/Others'));
  // Column "Category" (AS in the real workbook) holds a genuine per-employee
  // JOB GRADE (Mgt/Admin/Supervisor/Technical/MO — confirmed by inspecting
  // real values against real employee rows). It is NOT the same thing as
  // the department/cost-centre codes (Finance/TC/TA/GM/Production-511/512)
  // used elsewhere in the app (lib/payroll-engine.ts's CC_NAMES) — those
  // only appear in a separate, manually-typed summary table at the bottom
  // of the sheet with NO traceable per-employee mapping anywhere in the
  // workbook (verified: no column in the employee row range contains those
  // exact department strings). Cost centre assignment per employee is
  // therefore NOT available from this source file — every employee below
  // gets a single placeholder cost_centre/department (ASSUMPTION, see
  // DEFAULT_COST_CENTRE below) until Tony provides the real per-employee
  // assignment; this only needs a data edit via the Master Data Hub later,
  // not a script change.
  const gradeIndex = header.findIndex((cell) => cell === 'Category');

  // ASSUMPTION: no real per-employee cost-centre exists in the source sheet
  // (see comment above). Defaulting everyone to Production (511) — the
  // largest single group per the sheet's own summary table (19 of 46) — is
  // a placeholder, not a verified fact. Flag for Tony to confirm/correct.
  const DEFAULT_COST_CENTRE = '511';
  const DEFAULT_DEPARTMENT = 'Production';

  // Two employees confirmed (via cell-by-cell formula tracing against the
  // "AI-Automation-workings" sheet) to use Tony's alternate PAYE-band basis
  // and a non-standard combined personal/life-insurance/education relief —
  // see lib/payroll-engine.ts's file header. These are the ONLY employees
  // verified so far; per instruction, more may exist and Tony will confirm
  // the real list later — this is an editable data table, not hardcoded
  // logic, so adding/removing entries here never requires a code change
  // beyond this seed list.
  const PAYE_EXCEPTIONS = {
    '1000': { exclude_nssf_from_paye_bands: true, personal_relief_override: 2400 + 1436.54 + 3454.18 },
    '1001': { exclude_nssf_from_paye_bands: true, personal_relief_override: 2400 + 480 },
  };

  const employeeRows = [];
  const skippedRows = [];
  const usedKraPins = new Set();

  // Bounded to the confirmed real employee block (49 row slots directly
  // below the header — verified by direct inspection). The sheet continues
  // for 183 rows total with unrelated side-tables (leave tracking, OT
  // calculations, a small unrelated name table) below that; scanning the
  // whole sheet previously let a few of those rows leak in as phantom
  // "employees" despite the junk-keyword filters.
  // +1 for a blank spacer row directly under the header, +49 for the real
  // employee row slots (verified: the loop's own blank-row skip previously
  // consumed one of the 49 slots on that spacer row, silently dropping the
  // last real employee — confirmed by diffing imported staff numbers
  // against the expected 1000-1049 range).
  const REAL_EMPLOYEE_ROW_COUNT = 1 + 49;
  const dataRowLimit = Math.min(rows.length, headerIndex + 1 + REAL_EMPLOYEE_ROW_COUNT);

  for (let i = headerIndex + 1; i < dataRowLimit; i++) {
    const row = rows[i] || [];
    const rawStaffNo = String(row[staffIndex] ?? '').trim();
    const rawName = String(row[nameIndex] ?? '').trim();
    const kraPin = String(row[pinIndex] ?? '').trim();

    // Skip fully blank rows
    if (!rawStaffNo && !rawName && !kraPin) {
      continue;
    }

    // A row with NO staff number AND NO name has no way to identify a real
    // employee, even if some other column (salary, PIN) happens to be
    // non-empty. These are almost always spacer/subtotal artifacts, not
    // employees, and they were causing ID/PIN collisions on import.
    if (!rawStaffNo && !isRealName(rawName)) {
      skippedRows.push({ row: i + 1, staffNo: rawStaffNo, name: rawName, kraPin, reason: 'no_staff_no_or_name' });
      continue;
    }

    // A "name" that's actually a currency figure (e.g. "30,313.94") means a
    // salary value leaked into the Name column for this row — not a person.
    if (isCurrencyLike(rawName) || isCurrencyLike(rawStaffNo)) {
      skippedRows.push({ row: i + 1, staffNo: rawStaffNo, name: rawName, kraPin, reason: 'currency_value_not_a_name' });
      continue;
    }

    // Skip rows that look like totals/header/junk, not real employees
    if (isJunkRow({ staffNo: rawStaffNo, rawName, kraPin })) {
      skippedRows.push({ row: i + 1, staffNo: rawStaffNo, name: rawName, kraPin, reason: 'junk_row' });
      continue;
    }

    const employeeId = extractEmployeeId(row, staffIndex, nameIndex);
    const staffNo = employeeId || rawStaffNo || rawName;

    if (!staffNo && !kraPin) {
      continue;
    }

    // Use the REAL name from the sheet. Fall back to a placeholder if the
    // Name column is empty OR if it's purely numeric (a number in the Name
    // column is a staff-number artifact, not a real person's name).
    const looksLikeARealName = rawName && !/^\d+$/.test(rawName);
    const employeeName = looksLikeARealName ? rawName : `Employee ${staffNo || i}`;

    const grade = String(row[gradeIndex] ?? '').trim() || 'Staff';
    const basicSalary = toCurrencyNumber(row[basicIndex]);
    const bonusCommission = toCurrencyNumber(row[bonusIndex]);
    const fringeBenefit = toCurrencyNumber(row[fringeIndex]);
    const transportAllowance = toCurrencyNumber(row[transportIndex]);
    const arrears = toCurrencyNumber(row[arrearsIndex]);
    const otOther = toCurrencyNumber(row[othersIndex]);

    // Resolve a final KRA PIN, guaranteeing it's unique within this import
    // run. If the sheet has a genuine duplicate PIN (data entry error) or
    // this row has no PIN at all, fall back to a value keyed on the row
    // number so it can never collide with another row's PIN.
    let finalKraPin = kraPin || `PIN-${staffNo || i}`;
    if (usedKraPins.has(finalKraPin)) {
      finalKraPin = `${finalKraPin}-R${i}`;
    }
    usedKraPins.add(finalKraPin);

    const exception = PAYE_EXCEPTIONS[staffNo] || {};

    employeeRows.push({
      id: staffNo || `EMP-${i}`,
      name: employeeName,
      national_id: buildNationalId(staffNo, i),
      kra_pin: finalKraPin,
      // Not present anywhere in the source workbook — placeholder pending
      // real HR data from Tony, same as bank_name/bank_account_number below.
      sha_pin: null,
      grade,
      cost_centre: DEFAULT_COST_CENTRE,
      department: DEFAULT_DEPARTMENT,
      bank_name: 'N/A',
      bank_account_number: 'N/A',
      base_salary: basicSalary,
      bonus_commission: bonusCommission,
      fringe_benefit: fringeBenefit,
      transport_allowance: transportAllowance,
      arrears,
      ot_other: otOther,
      voluntary_pension: 0,
      advances: 0,
      helb: 0,
      company_loan: 0,
      bank_loan: 0,
      sacco: 0,
      exclude_nssf_from_paye_bands: exception.exclude_nssf_from_paye_bands ?? false,
      personal_relief_override: exception.personal_relief_override ?? null,
    });
  }

  const results = {
    found: employeeRows.length,
    inserted: 0,
    failed: [],
    skipped: skippedRows,
    ASSUMPTIONS_NEEDING_CONFIRMATION: [
      `cost_centre/department: every employee defaulted to ${DEFAULT_COST_CENTRE}/${DEFAULT_DEPARTMENT} — ` +
        'no per-employee cost-centre mapping exists anywhere in the source workbook (verified). ' +
        'Correct via the Master Data Hub once Tony confirms real assignments.',
      `bank_name/bank_account_number/sha_pin: placeholder ("N/A"/null) for all employees — not present in the source workbook.`,
      `PAYE exceptions: only staff ${Object.keys(PAYE_EXCEPTIONS).join(', ')} flagged so far (traced from formulas) — ` +
        'more may exist; Tony to confirm the complete list.',
    ],
  };

  for (const employee of employeeRows) {
    const { error } = await supabase
      .from('employees')
      .upsert(employee, { onConflict: 'id' });

    if (error) {
      results.failed.push({
        id: employee.id,
        name: employee.name,
        failure: error.message,
      });
      continue;
    }

    results.inserted += 1;
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error('IMPORT_FAILED');
  console.error(error?.message || error);
  process.exit(1);
});