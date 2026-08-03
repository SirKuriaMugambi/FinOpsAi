import {
  buildEmployeeDimension,
  allocateAcrossSplits,
  groupByDimension,
  CostAllocationError,
} from "@/lib/cost-allocation"

describe("buildEmployeeDimension", () => {
  it("maps an employee's department/cost_centre straight to an AxDimension", () => {
    const dimension = buildEmployeeDimension({ id: "1", department: "Finance", cost_centre: "121" })
    expect(dimension).toEqual({ department: "Finance", costCentre: "121" })
  })
})

describe("allocateAcrossSplits", () => {
  it("splits an amount proportionally across multiple cost centres", () => {
    const result = allocateAcrossSplits(100000, [
      { department: "OPS", costCentre: "511", percentage: 60 },
      { department: "FIN", costCentre: "121", percentage: 40 },
    ])

    expect(result).toHaveLength(2)
    expect(result[0].amount).toBeCloseTo(60000, 2)
    expect(result[1].amount).toBeCloseTo(40000, 2)
  })

  it("makes the allocated amounts sum EXACTLY to the input, absorbing rounding remainder into the last split", () => {
    const result = allocateAcrossSplits(100, [
      { department: "A", costCentre: "1", percentage: 33.33 },
      { department: "B", costCentre: "2", percentage: 33.33 },
      { department: "C", costCentre: "3", percentage: 33.34 },
    ])

    const total = result.reduce((sum, r) => sum + r.amount, 0)
    expect(+total.toFixed(2)).toBe(100)
  })

  it("throws CostAllocationError when splits don't sum to 100%", () => {
    expect(() =>
      allocateAcrossSplits(100000, [
        { department: "OPS", costCentre: "511", percentage: 60 },
        { department: "FIN", costCentre: "121", percentage: 30 },
      ]),
    ).toThrow(CostAllocationError)
  })

  it("throws CostAllocationError when no splits are given", () => {
    expect(() => allocateAcrossSplits(100000, [])).toThrow(CostAllocationError)
  })
})

describe("groupByDimension", () => {
  it("groups and sums amounts by department+cost centre", () => {
    const grouped = groupByDimension([
      { employee: { id: "1", department: "OPS", cost_centre: "511" }, amount: 100 },
      { employee: { id: "2", department: "OPS", cost_centre: "511" }, amount: 200 },
      { employee: { id: "3", department: "FIN", cost_centre: "121" }, amount: 50 },
    ])

    expect(grouped).toHaveLength(2)
    const production = grouped.find((g) => g.costCentre === "511")
    expect(production?.totalAmount).toBe(300)
    expect(production?.employeeCount).toBe(2)
  })
})
