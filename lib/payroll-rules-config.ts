/**
 * Kenyan statutory payroll rates/bands, extracted from lib/payroll-engine.ts
 * into one place so a rate change (new KRA PAYE bands, a NITA increase, etc.)
 * is a config edit, not a hunt through calculation logic.
 *
 * Source of truth: reference-data/CA- AI Payroll automation project.xlsx,
 * sheet "AI-Automation-workings" — see lib/payroll-engine.ts's header comment
 * for the full verification notes against real employee figures.
 */

export interface PayeBand {
  /** Upper bound of this band's taxable income slice, in KES. `null` = no upper bound (top band). */
  upTo: number | null
  rate: number
}

export const KENYA_PAYROLL_RULES_2024 = {
  /**
   * Which pay figure SHIF/AHL/pension are computed against. Tony's source
   * sheet uses "basic" (verified cent-for-cent) — that's the pilot default,
   * kept so the system matches his numbers exactly for sign-off. The
   * legally-standard definition of SHIF/AHL is "gross salary"; flip this to
   * "gross" only once Tony has approved and the company is ready to correct
   * its own methodology. This is a single global switch, not per-employee —
   * everyone moves together when it changes.
   */
  statutoryBasis: "basic" as "basic" | "gross",

  /**
   * NSSF Tier I/II — kept FLAT exactly as they appear in the source sheet,
   * not recalculated against newer earnings-limit bands, per instruction to
   * stay accurate to the original workbook.
   */
  nssfTier1Flat: 420,
  nssfTier2Flat: 1740,

  /** 2.75% of the statutory basis (BASIC by default — verified against Tony's sheet; legally "gross"). */
  shifRate: 0.0275,

  /** 1.5% of the statutory basis (BASIC by default — verified against Tony's sheet; legally "gross"). Affordable Housing Levy. */
  ahlRate: 0.015,
  /** 15% of the AHL contribution, applied as a tax credit against Gross PAYE. */
  ahlReliefRate: 0.15,

  /** 5% of the statutory basis (BASIC by default — verified against Tony's sheet), capped at this monthly ceiling. */
  pensionEmployeeRate: 0.05,
  pensionEmployeeCap: 20000,
  /** 10% of the statutory basis — employer match, same basis as the employee rate. */
  pensionEmployerRate: 0.10,

  /** Standard statutory monthly personal relief. Some expatriate/parent-company
   * staff carry a different figure — pass `personal_relief_override` per employee
   * rather than changing this default. */
  personalReliefStandard: 2400,

  /** NHIF/SHIF relief — currently 0 per the source sheet. */
  nhifReliefRate: 0,

  /** NITA training levy — flat per employee per month, employer-borne. */
  nitaFlatPerEmployee: 50,

  /** 2024–2026 KRA PAYE graduated monthly tax bands, applied cumulatively. */
  payeBands: [
    { upTo: 24000, rate: 0.10 },
    { upTo: 32333, rate: 0.25 },
    { upTo: 500000, rate: 0.30 },
    { upTo: 800000, rate: 0.325 },
    { upTo: null, rate: 0.35 },
  ] as PayeBand[],
} as const

export type KenyaPayrollRules = typeof KENYA_PAYROLL_RULES_2024
