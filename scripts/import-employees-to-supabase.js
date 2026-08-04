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
  // These four are safe to derive directly from the sheet: a blank cell
  // genuinely means "zero advance/loan/SACCO this month" for these fields
  // (no standard-nonzero-default ambiguity, unlike pension rate/personal
  // relief below, where a blank cell is ambiguous between "not entered"
  // and "confirmed zero" — those stay as verified hardcoded tables instead).
  const advancesIndex = header.findIndex((cell) => cell === 'Advances');
  const helbIndex = header.findIndex((cell) => cell === 'HELB');
  const companyLoanIndex = header.findIndex((cell) => cell === 'Company loan');
  const bankLoanIndex = header.findIndex((cell) => cell === 'Bank loan');
  const saccoIndex = header.findIndex((cell) => cell === 'SACCO');

  // ASSUMPTION: no real per-employee cost-centre exists in the source sheet
  // (see comment above). Defaulting everyone to Production (511) — the
  // largest single group per the sheet's own summary table (19 of 46) — is
  // a placeholder, not a verified fact. Flag for Tony to confirm/correct.
  const DEFAULT_COST_CENTRE = '511';
  const DEFAULT_DEPARTMENT = 'Production';

  // Confirmed via a full 46-employee audit against Tony's actual computed
  // Gross PAYE/Net PAYE/Net Pay (not spot-checks) that 7 employees use a
  // different flat PAYE-band deduction than the standard formula — traced
  // cell-by-cell against "AI-Automation-workings" band-3/4 formulas. This
  // genuinely can't be derived from this sheet alone (the Gross PAYE column
  // here is a static copied value, not a formula to reverse-engineer from),
  // so it stays a precise, verified lookup table rather than a guess.
  const PAYE_BAND_FLAT_DEDUCTION = {
    '1000': 20000, '1001': 45000, '1004': 20000, '1005': 0,
    '1007': 0, '1008': 20000, '1009': 45000, '1010': 20000,
  };

  // The "Voluntary pension Contribution" column in this sheet already has
  // Tony's excess-over-cap redirect baked in (see lib/payroll-engine.ts's
  // file header — the engine computes that redirect itself), so it can't be
  // read directly as the raw voluntary contribution. Only one employee has
  // a real voluntary contribution in the source data (verified against
  // "AI-Automation-workings" row 58) — kept as a small explicit exception
  // rather than mis-deriving it from this sheet's already-adjusted column.
  const RAW_VOLUNTARY_PENSION = { '1001': 9000 };

  // 12 employees have 0% employee pension in Tony's sheet, not the standard
  // 5% (verified: each one's row-59 formula in "AI-Automation-workings"
  // literally reads `*0%`, cross-checked against this sheet's own "Defined
  // Pension contribution" column being blank for the same 12). Hardcoded
  // rather than derived from this sheet at import time because a blank cell
  // here is ambiguous — could mean "confirmed zero" or "not entered yet" —
  // and this list was verified against the source formulas directly, not
  // inferred from blankness alone.
  const PENSION_RATE_OVERRIDE = {
    '1007': 0, '1025': 0, '1027': 0, '1028': 0, '1029': 0, '1043': 0,
    '1044': 0, '1045': 0, '1046': 0, '1047': 0, '1048': 0, '1049': 0,
  };

  // 5 of the lowest-paid employees have a non-flat NSSF Tier II in Tony's
  // sheet — verified formula `(gross − 600 − 7000) × 6%`, not the flat
  // 1,740 everyone else uses. Exact values read from his sheet directly.
  const NSSF_T2_OVERRIDE = {
    '1045': 1093.6363636363637, '1046': 1216.3636363636363,
    '1047': 1167.2727272727273, '1048': 1118.181818181818,
    '1049': 1056.8181818181818,
  };

  // 9 employees carry a non-standard Personal Relief in Tony's sheet — his
  // "Personal Relief" column combines the standard KES 2,400 with real
  // life-insurance and/or education-policy reliefs (or, for staff 1005/1007,
  // reduces it to zero entirely — a genuine, verified figure, not a data
  // gap). Read directly from his own computed "Personal Relief" cell
  // (negated — his sheet stores it as a negative adjustment) rather than
  // re-deriving from the separate life-insurance/education-policy rows.
  const PERSONAL_RELIEF_OVERRIDE = {
    '1000': 7290.72, '1001': 3717.41, '1005': 0, '1007': 0, '1010': 4972.5,
    '1018': 3915, '1025': 4740, '1031': 3000.15, '1037': 2774.25,
  };

  // 2 employees have zero AHL relief in Tony's sheet, not the standard 15%
  // of their AHL contribution — his "AHL Relief" column is blank for both,
  // alongside their also-zero Personal Relief above (no reliefs applied to
  // either of these two at all).
  const AHL_RELIEF_OVERRIDE = { '1005': 0, '1007': 0 };

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
    const advances = toCurrencyNumber(row[advancesIndex]);
    const helb = toCurrencyNumber(row[helbIndex]);
    const companyLoan = toCurrencyNumber(row[companyLoanIndex]);
    const bankLoan = toCurrencyNumber(row[bankLoanIndex]);
    const sacco = toCurrencyNumber(row[saccoIndex]);

    // Resolve a final KRA PIN, guaranteeing it's unique within this import
    // run. If the sheet has a genuine duplicate PIN (data entry error) or
    // this row has no PIN at all, fall back to a value keyed on the row
    // number so it can never collide with another row's PIN.
    let finalKraPin = kraPin || `PIN-${staffNo || i}`;
    if (usedKraPins.has(finalKraPin)) {
      finalKraPin = `${finalKraPin}-R${i}`;
    }
    usedKraPins.add(finalKraPin);

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
      voluntary_pension: RAW_VOLUNTARY_PENSION[staffNo] ?? 0,
      advances,
      helb,
      company_loan: companyLoan,
      bank_loan: bankLoan,
      sacco,
      personal_relief_override: PERSONAL_RELIEF_OVERRIDE[staffNo] ?? null,
      paye_band_flat_deduction: PAYE_BAND_FLAT_DEDUCTION[staffNo] ?? null,
      pension_rate_override: PENSION_RATE_OVERRIDE[staffNo] ?? null,
      nssf_t2_override: NSSF_T2_OVERRIDE[staffNo] ?? null,
      ahl_relief_override: AHL_RELIEF_OVERRIDE[staffNo] ?? null,
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
      `Statutory overrides: verified against a full 46-employee audit against Tony's actual Gross PAYE/Net PAYE/Net Pay ` +
        `(not spot-checks) — paye_band_flat_deduction for ${Object.keys(PAYE_BAND_FLAT_DEDUCTION).join(', ')}, ` +
        `pension_rate_override=0 for ${Object.keys(PENSION_RATE_OVERRIDE).join(', ')}, ` +
        `nssf_t2_override for ${Object.keys(NSSF_T2_OVERRIDE).join(', ')}, ` +
        `personal_relief_override for ${Object.keys(PERSONAL_RELIEF_OVERRIDE).join(', ')}. ` +
        'This is Nov 2024 data — Tony should still confirm nothing has changed since.',
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