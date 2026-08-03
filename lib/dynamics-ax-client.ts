/**
 * Wraps Microsoft Dynamics AX/365FO OData/REST calls for posting payroll
 * journals. No real AX environment is configured yet, so this client is
 * config-driven and self-mocking: with DYNAMICS_AX_* env vars unset, every
 * call returns a clearly-flagged mock response instead of throwing — the
 * rest of the app (API route, UI) can be built and tested end-to-end today,
 * and posting goes live the moment real config is supplied.
 *
 * Real endpoint shape once configured (typical D365FO pattern — confirm
 * exact entity/action names against the target environment before going
 * live, they vary by version and customization):
 *   Auth:   POST {authUrl}/oauth2/token  (OAuth2 client-credentials grant)
 *   Create: POST {baseUrl}/data/{journalEntityName}
 *   Lines:  POST {baseUrl}/data/{journalLineEntityName}
 *   Post:   POST {baseUrl}/data/{journalEntityName}/Microsoft.Dynamics.DataEntities.Post
 * See docs/dynamics_ax_notes.md (create this file with the real tenant/host
 * details once IT/finance provides them) and CLAUDE.md's "Configuring AX
 * integration" section for the env vars this reads.
 */

import type { PayrollJournal } from "@/lib/journal-builder"

export interface DynamicsAxConfig {
  baseUrl: string
  authUrl: string
  tenantId: string
  clientId: string
  clientSecret: string
  resource: string
  journalEntityName: string
  journalLineEntityName: string
  legalEntity: string
}

export function loadAxConfigFromEnv(): DynamicsAxConfig | null {
  const {
    DYNAMICS_AX_BASE_URL,
    DYNAMICS_AX_AUTH_URL,
    DYNAMICS_AX_TENANT_ID,
    DYNAMICS_AX_CLIENT_ID,
    DYNAMICS_AX_CLIENT_SECRET,
    DYNAMICS_AX_RESOURCE,
    DYNAMICS_AX_JOURNAL_ENTITY,
    DYNAMICS_AX_JOURNAL_LINE_ENTITY,
    DYNAMICS_AX_LEGAL_ENTITY,
  } = process.env

  if (
    !DYNAMICS_AX_BASE_URL ||
    !DYNAMICS_AX_AUTH_URL ||
    !DYNAMICS_AX_TENANT_ID ||
    !DYNAMICS_AX_CLIENT_ID ||
    !DYNAMICS_AX_CLIENT_SECRET
  ) {
    return null
  }

  return {
    baseUrl: DYNAMICS_AX_BASE_URL,
    authUrl: DYNAMICS_AX_AUTH_URL,
    tenantId: DYNAMICS_AX_TENANT_ID,
    clientId: DYNAMICS_AX_CLIENT_ID,
    clientSecret: DYNAMICS_AX_CLIENT_SECRET,
    resource: DYNAMICS_AX_RESOURCE ?? DYNAMICS_AX_BASE_URL,
    journalEntityName: DYNAMICS_AX_JOURNAL_ENTITY ?? "GeneralJournalHeaders",
    journalLineEntityName: DYNAMICS_AX_JOURNAL_LINE_ENTITY ?? "GeneralJournalLines",
    legalEntity: DYNAMICS_AX_LEGAL_ENTITY ?? "CHAF",
  }
}

export interface AxJournalLinePayload {
  LineNumber: number
  MainAccountId: string
  DebitAmount: number
  CreditAmount: number
  Description: string
  // Financial dimension values — the concrete field name AX expects
  // (`DefaultDimensionDisplayValue`, a dimension-set string, or discrete
  // `Department`/`CostCenter` fields) depends on how dimensions are
  // configured in the target environment; confirm against a real /metadata
  // call before going live.
  Department: string
  CostCenter: string
}

export interface AxJournalPayload {
  JournalName: string
  LegalEntity: string
  Description: string
  Currency: string
  Lines: AxJournalLinePayload[]
}

/** Pure transform: PayrollJournal -> the wire payload shape AX expects. No I/O. */
export function createPayrollJournal(journal: PayrollJournal, legalEntity = "CHAF"): AxJournalPayload {
  return {
    JournalName: journal.journalName,
    LegalEntity: legalEntity,
    Description: `Payroll journal for ${journal.month}`,
    Currency: journal.currency,
    Lines: journal.lines.map((line) => ({
      LineNumber: line.lineNumber,
      MainAccountId: line.accountCode,
      DebitAmount: line.debit,
      CreditAmount: line.credit,
      Description: line.description,
      Department: line.dimension.department,
      CostCenter: line.dimension.costCentre,
    })),
  }
}

export interface AxPostResult {
  success: boolean
  isMock: boolean
  journalNumber: string
  message: string
  raw?: unknown
}

async function getAccessToken(config: DynamicsAxConfig): Promise<string> {
  const response = await fetch(config.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      resource: config.resource,
    }),
  })

  if (!response.ok) {
    throw new Error(`AX auth failed: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error("AX auth response did not include an access_token.")
  }
  return data.access_token
}

/**
 * Posts a payroll journal to AX. Without DYNAMICS_AX_* env config, returns a
 * mock success response (isMock: true) instead of making any network call —
 * this is the expected/normal path until a real AX environment is wired up.
 */
export async function postPayrollJournal(payload: AxJournalPayload): Promise<AxPostResult> {
  const config = loadAxConfigFromEnv()

  if (!config) {
    return {
      success: true,
      isMock: true,
      journalNumber: `MOCK-${payload.JournalName}`,
      message: "DYNAMICS_AX_* env vars are not configured — returning a mocked success response. See CLAUDE.md to configure real posting.",
    }
  }

  const token = await getAccessToken(config)

  const createResponse = await fetch(`${config.baseUrl}/data/${config.journalEntityName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "OData-Version": "4.0",
    },
    body: JSON.stringify(payload),
  })

  if (!createResponse.ok) {
    const body = await createResponse.text()
    return {
      success: false,
      isMock: false,
      journalNumber: "",
      message: `AX rejected the journal: ${createResponse.status} ${body}`,
    }
  }

  const created = await createResponse.json()

  return {
    success: true,
    isMock: false,
    journalNumber: created?.JournalName ?? payload.JournalName,
    message: "Journal created in AX.",
    raw: created,
  }
}
