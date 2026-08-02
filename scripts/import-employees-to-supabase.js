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
  const staffIndex = header.findIndex((cell) => cell === 'Staff No');
  const nameIndex = header.findIndex((cell) => cell === 'Name');
  const pinIndex = header.findIndex((cell) => cell === 'Pin No');
  const basicIndex = header.findIndex((cell) => cell.includes('Basic'));
  const bonusIndex = header.findIndex((cell) => cell.includes('Bonus/Comm'));
  const fringeIndex = header.findIndex((cell) => cell.includes('Fringe benefit'));
  const transportIndex = header.findIndex((cell) => cell.includes('Transport/Hse Allowance'));
  const arrearsIndex = header.findIndex((cell) => cell.includes('Arrears'));
  const othersIndex = header.findIndex((cell) => cell.includes('Salary Arrears/OT/Others'));
  const departmentIndex = header.findIndex((cell) => cell === 'Category');

  const employeeRows = [];
  const skippedRows = [];
  const usedKraPins = new Set();

  for (let i = headerIndex + 1; i < rows.length; i++) {
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

    const department = String(row[departmentIndex] ?? '').trim() || 'Production';
    const grade = department || 'Staff';
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

    employeeRows.push({
      id: staffNo || `EMP-${i}`,
      name: employeeName,
      national_id: buildNationalId(staffNo, i),
      kra_pin: finalKraPin,
      sha_pin: null,
      grade,
      cost_centre: '511',
      department,
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
    });
  }

  const results = {
    found: employeeRows.length,
    inserted: 0,
    failed: [],
    skipped: skippedRows,
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