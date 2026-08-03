import { createPayrollJournal, postPayrollJournal, loadAxConfigFromEnv } from "@/lib/dynamics-ax-client"
import type { PayrollJournal } from "@/lib/journal-builder"

const sampleJournal: PayrollJournal = {
  month: "2026-08",
  journalName: "PAYROLL-2026-08",
  currency: "KES",
  lines: [
    {
      lineNumber: 1,
      accountCode: "41000",
      accountName: "Salary & Wages Expense",
      debit: 100000,
      credit: 0,
      dimension: { department: "OPS", costCentre: "511" },
      description: "Gross salary",
    },
    {
      lineNumber: 2,
      accountCode: "11500",
      accountName: "Net Salaries Payable",
      debit: 0,
      credit: 100000,
      dimension: { department: "FIN", costCentre: "121" },
      description: "Net pay",
    },
  ],
  totalDebit: 100000,
  totalCredit: 100000,
  isBalanced: true,
}

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...ORIGINAL_ENV }
  delete process.env.DYNAMICS_AX_BASE_URL
  delete process.env.DYNAMICS_AX_AUTH_URL
  delete process.env.DYNAMICS_AX_TENANT_ID
  delete process.env.DYNAMICS_AX_CLIENT_ID
  delete process.env.DYNAMICS_AX_CLIENT_SECRET
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe("createPayrollJournal", () => {
  it("transforms a PayrollJournal into the AX wire payload shape, preserving debits/credits/dimensions", () => {
    const payload = createPayrollJournal(sampleJournal, "CHAF")

    expect(payload.LegalEntity).toBe("CHAF")
    expect(payload.Lines).toHaveLength(2)
    expect(payload.Lines[0]).toMatchObject({
      MainAccountId: "41000",
      DebitAmount: 100000,
      CreditAmount: 0,
      Department: "OPS",
      CostCenter: "511",
    })
  })
})

describe("loadAxConfigFromEnv", () => {
  it("returns null when DYNAMICS_AX_* env vars are not set", () => {
    expect(loadAxConfigFromEnv()).toBeNull()
  })

  it("returns a config object when all required env vars are set", () => {
    process.env.DYNAMICS_AX_BASE_URL = "https://example.dynamics.com"
    process.env.DYNAMICS_AX_AUTH_URL = "https://login.microsoftonline.com/tenant/oauth2/token"
    process.env.DYNAMICS_AX_TENANT_ID = "tenant-id"
    process.env.DYNAMICS_AX_CLIENT_ID = "client-id"
    process.env.DYNAMICS_AX_CLIENT_SECRET = "secret"

    const config = loadAxConfigFromEnv()
    expect(config).not.toBeNull()
    expect(config?.baseUrl).toBe("https://example.dynamics.com")
    expect(config?.journalEntityName).toBe("GeneralJournalHeaders") // default
  })
})

describe("postPayrollJournal", () => {
  it("returns a mocked success response with no network call when AX is not configured", async () => {
    const fetchSpy = jest.spyOn(global, "fetch")
    const payload = createPayrollJournal(sampleJournal)

    const result = await postPayrollJournal(payload)

    expect(result.success).toBe(true)
    expect(result.isMock).toBe(true)
    expect(result.journalNumber).toContain("MOCK-")
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it("calls the real AX endpoints (auth then journal create) when configured", async () => {
    process.env.DYNAMICS_AX_BASE_URL = "https://example.dynamics.com"
    process.env.DYNAMICS_AX_AUTH_URL = "https://login.microsoftonline.com/tenant/oauth2/token"
    process.env.DYNAMICS_AX_TENANT_ID = "tenant-id"
    process.env.DYNAMICS_AX_CLIENT_ID = "client-id"
    process.env.DYNAMICS_AX_CLIENT_SECRET = "secret"

    const fetchMock = jest
      .fn()
      // 1st call: OAuth token request
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "fake-token" }),
      })
      // 2nd call: journal create
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ JournalName: "PAYROLL-2026-08" }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    const payload = createPayrollJournal(sampleJournal)
    const result = await postPayrollJournal(payload)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
    expect(result.isMock).toBe(false)
    expect(result.journalNumber).toBe("PAYROLL-2026-08")
  })

  it("reports failure without throwing when AX rejects the journal", async () => {
    process.env.DYNAMICS_AX_BASE_URL = "https://example.dynamics.com"
    process.env.DYNAMICS_AX_AUTH_URL = "https://login.microsoftonline.com/tenant/oauth2/token"
    process.env.DYNAMICS_AX_TENANT_ID = "tenant-id"
    process.env.DYNAMICS_AX_CLIENT_ID = "client-id"
    process.env.DYNAMICS_AX_CLIENT_SECRET = "secret"

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "fake-token" }) })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "Invalid dimension value" })
    global.fetch = fetchMock as unknown as typeof fetch

    const payload = createPayrollJournal(sampleJournal)
    const result = await postPayrollJournal(payload)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Invalid dimension value")
  })
})
