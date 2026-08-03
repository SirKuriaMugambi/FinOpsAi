import * as XLSX from "xlsx"
import { parsePayrollWorksheet } from "@/lib/excel-ingest"

function buildWorksheet(rows: unknown[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows)
}

describe("parsePayrollWorksheet", () => {
  const header = [
    "Staff No", "Name", "Pin No", "Basic", "Bonus/Comm", "Fringe benefit",
    "Transport/Hse Allowance", "Arrears", "Salary Arrears/OT/Others", "Category",
  ]

  it("parses real employee rows using header-driven column detection", () => {
    const worksheet = buildWorksheet([
      header,
      ["1", "Jane Wanjiru", "A012345678Z", 100000, 5000, 1000, 5000, 0, 0, "Finance"],
      ["2", "John Otieno", "A987654321Z", 80000, 0, 0, 5000, 0, 2000, "Production"],
    ])

    const { rows } = parsePayrollWorksheet(worksheet)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      id: "1",
      name: "Jane Wanjiru",
      kraPin: "A012345678Z",
      department: "Finance",
      baseSalary: 100000,
      bonusCommission: 5000,
      fringeBenefit: 1000,
      transportAllowance: 5000,
      otOther: 0,
    })
    expect(rows[1].otOther).toBe(2000)
  })

  it("falls back to a placeholder name when the Name column is empty or purely numeric", () => {
    const worksheet = buildWorksheet([
      header,
      ["3", "1002", "A111111111Z", 50000, 0, 0, 0, 0, 0, "Technical"],
      ["4", "", "A222222222Z", 40000, 0, 0, 0, 0, 0, "Technical"],
    ])

    const { rows } = parsePayrollWorksheet(worksheet)
    expect(rows[0].name).toBe("Employee 3")
    expect(rows[1].name).toBe("Employee 4")
  })

  it("skips totals/subtotal/junk rows and rows with no identifying data", () => {
    const worksheet = buildWorksheet([
      header,
      ["", "", "", "", "", "", "", "", "", ""],
      ["", "TOTAL", "", 500000, "", "", "", "", "", ""],
      ["5", "Real Employee", "A333333333Z", 60000, 0, 0, 0, 0, 0, "Production"],
    ])

    const { rows, skipped } = parsePayrollWorksheet(worksheet)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe("Real Employee")
    expect(skipped.length).toBeGreaterThan(0)
  })

  it("skips rows where a currency-formatted figure leaked into the Name/Staff-No column", () => {
    const worksheet = buildWorksheet([
      header,
      ["", "30,313.94", "", "", "", "", "", "", "", ""],
      ["6", "Valid Employee", "A444444444Z", 45000, 0, 0, 0, 0, 0, "Production"],
    ])

    const { rows } = parsePayrollWorksheet(worksheet)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe("6")
  })

  it("throws a clear error when no 'Staff No' header row exists", () => {
    const worksheet = buildWorksheet([
      ["Some", "Other", "Sheet", "Layout"],
      [1, 2, 3, 4],
    ])

    expect(() => parsePayrollWorksheet(worksheet)).toThrow(/Staff No/)
  })

  it("detects a shifted Staff No/Name header (Tony's real workbook quirk) and reads the real staff number from the mislabeled Name column", () => {
    // Mirrors the real reference workbook: "Staff No" holds a throwaway
    // 1,2,3... row sequence, and the real staff number (1000,1001,...)
    // sits under a "Name" label with no actual name data.
    const worksheet = buildWorksheet([
      header,
      ["1", "1000", "A00000000Z1", 398051.75, 0, 545.83, 0, 0, 0, ""],
      ["2", "1001", "A00000000Z2", 440577.94, 0, 390, 0, 0, 0, ""],
      ["3", "1002", "A00000000Z3", 240632.93, 0, 8766.42, 5437.22, 0, 0, ""],
    ])

    const { rows } = parsePayrollWorksheet(worksheet)
    expect(rows.map((r) => r.id)).toEqual(["1000", "1001", "1002"])
    expect(rows[0].name).toBe("Employee 1000")
    expect(rows[0].baseSalary).toBeCloseTo(398051.75, 2)
  })

  it("still detects the shifted header when a blank spacer row sits directly under the header (matches the real reference workbook exactly)", () => {
    const worksheet = buildWorksheet([
      header,
      ["", "", "", "", "", "", "", "", "", ""], // blank spacer row, as in the real file
      ["1", "1000", "A00000000Z1", 398051.75, 0, 545.83, 0, 0, 0, ""],
      ["2", "1001", "A00000000Z2", 440577.94, 0, 390, 0, 0, 0, ""],
      ["3", "1002", "A00000000Z3", 240632.93, 0, 8766.42, 5437.22, 0, 0, ""],
    ])

    const { rows } = parsePayrollWorksheet(worksheet)
    expect(rows.map((r) => r.id)).toEqual(["1000", "1001", "1002"])
  })

  it("does NOT treat a normal small-numbered Staff No column as shifted when Name holds real names", () => {
    const worksheet = buildWorksheet([
      header,
      ["1", "Jane Wanjiru", "A012345678Z", 100000, 0, 0, 0, 0, 0, ""],
      ["2", "John Otieno", "A987654321Z", 80000, 0, 0, 0, 0, 0, ""],
    ])

    const { rows } = parsePayrollWorksheet(worksheet)
    expect(rows.map((r) => r.id)).toEqual(["1", "2"])
    expect(rows[0].name).toBe("Jane Wanjiru")
  })

  it("defaults department to 'Production' when the Category column is blank", () => {
    const worksheet = buildWorksheet([
      header,
      ["7", "No Category Employee", "A555555555Z", 30000, 0, 0, 0, 0, 0, ""],
    ])

    const { rows } = parsePayrollWorksheet(worksheet)
    expect(rows[0].department).toBe("Production")
  })
})
