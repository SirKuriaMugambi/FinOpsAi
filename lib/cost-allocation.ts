/**
 * Maps payroll amounts to Dynamics AX financial dimensions (department +
 * cost centre). The current employee data model (public.employees /
 * lib/seeds.ts) carries exactly one department/cost_centre per employee —
 * there's no multi-cost-centre split data anywhere in the schema today — so
 * `buildEmployeeDimension` covers the real, current use case, while
 * `allocateAcrossSplits` exists for the future case (e.g. a shared-services
 * employee whose cost should be split 60/40 across two centres) and is unit
 * tested against that scenario even though nothing calls it with >1 split yet.
 */

export interface AxDimension {
  department: string
  costCentre: string
}

export interface CostAllocationSplit extends AxDimension {
  /** 0–100. All splits for one employee/amount must sum to exactly 100. */
  percentage: number
}

export interface AllocatedAmount {
  dimension: AxDimension
  amount: number
}

export interface EmployeeForAllocation {
  id: string
  department: string
  cost_centre: string
}

/** The single-cost-centre case: today's actual data shape, one dimension per employee. */
export function buildEmployeeDimension(employee: EmployeeForAllocation): AxDimension {
  return {
    department: employee.department,
    costCentre: employee.cost_centre,
  }
}

export class CostAllocationError extends Error {}

/**
 * Splits a monetary amount across multiple cost-centre dimensions. Throws
 * CostAllocationError if the splits don't sum to 100% (within a small
 * floating-point tolerance) — a silent misallocation would misstate cost
 * centre P&L, so this fails loudly rather than allocating anyway.
 */
export function allocateAcrossSplits(amount: number, splits: CostAllocationSplit[]): AllocatedAmount[] {
  if (splits.length === 0) {
    throw new CostAllocationError("At least one cost allocation split is required.")
  }

  const totalPercentage = splits.reduce((sum, s) => sum + s.percentage, 0)
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new CostAllocationError(
      `Cost allocation splits must sum to 100% — got ${totalPercentage}%.`,
    )
  }

  // Round every split's share to 2dp, then push any rounding remainder onto
  // the last line so the allocated amounts sum EXACTLY to the input amount
  // (required for the journal builder's debit=credit check to hold).
  const rounded = splits.map((split) => ({
    dimension: { department: split.department, costCentre: split.costCentre },
    amount: +((amount * split.percentage) / 100).toFixed(2),
  }))

  const roundedTotal = rounded.reduce((sum, r) => sum + r.amount, 0)
  const remainder = +(amount - roundedTotal).toFixed(2)
  if (remainder !== 0 && rounded.length > 0) {
    rounded[rounded.length - 1].amount = +(rounded[rounded.length - 1].amount + remainder).toFixed(2)
  }

  return rounded
}

export interface CostCentreDimensionTotal extends AxDimension {
  totalAmount: number
  employeeCount: number
}

/**
 * Groups a list of (employee, amount) pairs by their AX dimension — the
 * building block for per-cost-centre journal lines (each cost centre gets
 * its own debit line rather than one lump-sum company-wide line).
 */
export function groupByDimension(
  entries: Array<{ employee: EmployeeForAllocation; amount: number }>,
): CostCentreDimensionTotal[] {
  const map = new Map<string, CostCentreDimensionTotal>()

  for (const { employee, amount } of entries) {
    const dimension = buildEmployeeDimension(employee)
    const key = `${dimension.department}::${dimension.costCentre}`
    const existing = map.get(key)
    if (existing) {
      existing.totalAmount = +(existing.totalAmount + amount).toFixed(2)
      existing.employeeCount += 1
    } else {
      map.set(key, { ...dimension, totalAmount: +amount.toFixed(2), employeeCount: 1 })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.costCentre.localeCompare(b.costCentre))
}
