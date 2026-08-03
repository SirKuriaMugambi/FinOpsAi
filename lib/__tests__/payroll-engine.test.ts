import { computePayroll, buildGLPosting, buildCostCentreBreakdown } from "@/lib/payroll-engine"

describe("computePayroll", () => {
  it("computes a simple employee with only basic salary (hand-verified against the KRA bands)", () => {
    const result = computePayroll({
      base_salary: 100000,
      bonus_commission: 0,
      fringe_benefit: 0,
      transport_allowance: 0,
      arrears: 0,
      ot_other: 0,
      voluntary_pension: 0,
      advances: 0,
      helb: 0,
      company_loan: 0,
      bank_loan: 0,
      sacco: 0,
    })

    expect(result.gross_salary).toBe(100000)
    expect(result.nssf_t1).toBe(420)
    expect(result.nssf_t2).toBe(1740)
    expect(result.shif).toBeCloseTo(2750, 2)
    expect(result.ahl).toBeCloseTo(1500, 2)
    expect(result.defined_pension_ee).toBeCloseTo(5000, 2)
    expect(result.defined_pension_er).toBeCloseTo(10000, 2)
    expect(result.taxable_pay).toBeCloseTo(92840, 2)
    // Band slices measured from (previous ceiling + 1), matching Tony's sheet
    // exactly: 24,000 + (32,333-24,001)*25% + (92,840-32,334)*30%
    expect(result.gross_paye).toBeCloseTo(22634.8, 2)
    expect(result.ahl_relief).toBeCloseTo(225, 2)
    expect(result.net_paye).toBeCloseTo(20009.8, 2)
    expect(result.total_deductions).toBeCloseTo(31419.8, 2)
    expect(result.net_salary).toBeCloseTo(68580.2, 2)
  })

  it("caps the employee pension contribution at the statutory ceiling for high earners", () => {
    const result = computePayroll({
      base_salary: 1000000,
      bonus_commission: 0,
      fringe_benefit: 0,
      transport_allowance: 0,
      arrears: 0,
      ot_other: 0,
      voluntary_pension: 0,
      advances: 0,
      helb: 0,
      company_loan: 0,
      bank_loan: 0,
      sacco: 0,
    })

    // 5% of 1,000,000 = 50,000, capped at 20,000
    expect(result.defined_pension_ee).toBe(20000)
  })

  it("redirects pension contributions above the statutory cap into voluntary deductions instead of dropping them", () => {
    const result = computePayroll({
      base_salary: 1000000,
      bonus_commission: 0,
      fringe_benefit: 0,
      transport_allowance: 0,
      arrears: 0,
      ot_other: 0,
      voluntary_pension: 9000,
      advances: 0,
      helb: 0,
      company_loan: 0,
      bank_loan: 0,
      sacco: 0,
    })

    // 5% of 1,000,000 = 50,000; excess over the 20,000 cap is 30,000,
    // which must still land somewhere in total_deductions (as voluntary).
    expect(result.defined_pension_ee).toBe(20000)
    expect(result.total_deductions).toBeCloseTo(
      result.net_paye + result.nssf_t1 + result.nssf_t2 + result.shif + result.ahl
        + result.defined_pension_ee + 9000 + 30000,
      2
    )
  })

  it("matches Tony's source sheet exactly for a real employee (Staff 1002, standard basis)", () => {
    // Reference: reference-data/CA- AI Payroll automation project.xlsx,
    // "Integrating with AX cost center", row 9 (Staff 1002).
    const result = computePayroll({
      base_salary: 240632.93144996982,
      bonus_commission: 0,
      fringe_benefit: 8766.417666666668, // mobile (1,499.751) + meals (600) + car/FBT (6,666.667)
      transport_allowance: 5437.215,
      arrears: 0,
      ot_other: 0,
      voluntary_pension: 0,
      advances: 0,
      helb: 0,
      company_loan: 0,
      bank_loan: 0,
      sacco: 0,
    })

    expect(result.gross_salary).toBeCloseTo(254836.56, 2)
    expect(result.gross_paye).toBeCloseTo(66976.28, 2)
  })

  it("matches Tony's source sheet exactly for the two expatriate employees on the alternate PAYE basis", () => {
    // Reference: Staff 1000 (col E) — Gross PAYE computed on (Gross − flat
    // 20,000), NSSF excluded from the band base, per Tony's sheet.
    const result = computePayroll({
      base_salary: 398051.75285295275,
      bonus_commission: 0,
      fringe_benefit: 545.832,
      transport_allowance: 0,
      arrears: 0,
      ot_other: 0,
      voluntary_pension: 0,
      advances: 0,
      helb: 0,
      company_loan: 0,
      bank_loan: 0,
      sacco: 0,
      excludeNssfFromPayeBands: true,
    })

    expect(result.gross_paye).toBeCloseTo(108362.08, 2)
  })

  it("does not let voluntary pension reduce taxable pay", () => {
    const withVoluntary = computePayroll({
      base_salary: 100000,
      bonus_commission: 0,
      fringe_benefit: 0,
      transport_allowance: 0,
      arrears: 0,
      ot_other: 0,
      voluntary_pension: 5000,
      advances: 0,
      helb: 0,
      company_loan: 0,
      bank_loan: 0,
      sacco: 0,
    })
    const withoutVoluntary = computePayroll({
      base_salary: 100000,
      bonus_commission: 0,
      fringe_benefit: 0,
      transport_allowance: 0,
      arrears: 0,
      ot_other: 0,
      voluntary_pension: 0,
      advances: 0,
      helb: 0,
      company_loan: 0,
      bank_loan: 0,
      sacco: 0,
    })

    expect(withVoluntary.taxable_pay).toBe(withoutVoluntary.taxable_pay)
    // But total deductions (and therefore net salary) must differ by the voluntary amount.
    expect(withVoluntary.total_deductions - withoutVoluntary.total_deductions).toBeCloseTo(5000, 2)
  })

  it("subtracts non-cash fringe benefit from net salary without adding it to deductions", () => {
    const result = computePayroll({
      base_salary: 100000,
      bonus_commission: 0,
      fringe_benefit: 10000,
      transport_allowance: 0,
      arrears: 0,
      ot_other: 0,
      voluntary_pension: 0,
      advances: 0,
      helb: 0,
      company_loan: 0,
      bank_loan: 0,
      sacco: 0,
    })

    expect(result.gross_salary).toBe(110000)
    // net_salary = gross - fringe_benefit - total_deductions
    expect(result.net_salary).toBeCloseTo(result.gross_salary - 10000 - result.total_deductions, 2)
  })

  it("respects a personal_relief_override for non-standard (e.g. expatriate) employees", () => {
    const result = computePayroll({
      base_salary: 100000,
      bonus_commission: 0,
      fringe_benefit: 0,
      transport_allowance: 0,
      arrears: 0,
      ot_other: 0,
      voluntary_pension: 0,
      advances: 0,
      helb: 0,
      company_loan: 0,
      bank_loan: 0,
      sacco: 0,
      personal_relief_override: 5000,
    })

    expect(result.personal_relief).toBe(5000)
  })
})

describe("buildGLPosting", () => {
  it("sums gross, statutory, and net totals across employees, with NITA at a flat KES 50/head", () => {
    const summaries = [
      { id: "1", name: "A", kra_pin: "P1", cost_centre: "511", gross_salary: 100000, net_paye: 20010.35, nssf_t1: 420, nssf_t2: 1740, shif: 2750, ahl: 1500, defined_pension_ee: 5000, defined_pension_er: 10000, helb: 0, company_loan: 0, bank_loan: 0, sacco: 0, advances: 0, net_salary: 68579.65 },
      { id: "2", name: "B", kra_pin: "P2", cost_centre: "121", gross_salary: 50000, net_paye: 5000, nssf_t1: 420, nssf_t2: 1740, shif: 1375, ahl: 750, defined_pension_ee: 2500, defined_pension_er: 5000, helb: 0, company_loan: 0, bank_loan: 0, sacco: 0, advances: 0, net_salary: 38215 },
    ]

    const gl = buildGLPosting(summaries)
    expect(gl.gross_salaries).toBeCloseTo(150000, 2)
    expect(gl.nita_total).toBe(100) // 2 employees * 50
    expect(gl.net_salaries).toBeCloseTo(106794.65, 2)
  })
})

describe("buildCostCentreBreakdown", () => {
  it("groups employees by cost centre and sums per-centre totals", () => {
    const summaries = [
      { id: "1", name: "A", kra_pin: "P1", cost_centre: "511", gross_salary: 100000, net_paye: 20000, nssf_t1: 420, nssf_t2: 1740, shif: 2750, ahl: 1500, defined_pension_ee: 5000, defined_pension_er: 10000, helb: 0, company_loan: 0, bank_loan: 0, sacco: 0, advances: 0, net_salary: 68580 },
      { id: "2", name: "B", kra_pin: "P2", cost_centre: "511", gross_salary: 50000, net_paye: 5000, nssf_t1: 420, nssf_t2: 1740, shif: 1375, ahl: 750, defined_pension_ee: 2500, defined_pension_er: 5000, helb: 0, company_loan: 0, bank_loan: 0, sacco: 0, advances: 0, net_salary: 38215 },
    ]

    const breakdown = buildCostCentreBreakdown(summaries)
    expect(breakdown).toHaveLength(1)
    expect(breakdown[0].code).toBe("511")
    expect(breakdown[0].headcount).toBe(2)
    expect(breakdown[0].gross).toBeCloseTo(150000, 2)
  })
})
