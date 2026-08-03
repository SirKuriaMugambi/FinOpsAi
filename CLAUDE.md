@AGENTS.md

# Payroll → Dynamics AX Journal Posting

Monthly payroll runs through the KRA statutory engine, then builds a
GAAP-correct journal for Microsoft Dynamics AX. Everything lives inside this
Next.js app under `lib/` and `app/api/payroll/` — there is no separate
standalone Node service.

## Project structure

```
lib/
  payroll-rules-config.ts   KRA PAYE bands, NSSF/SHIF/AHL/pension rates, NITA —
                             the ONE place to update a statutory rate change.
  payroll-engine.ts          computePayroll() and per-run GL/variance summaries.
                             Imports payroll-rules-config.ts; don't hard-code
                             rates back into this file.
  cost-allocation.ts         AxDimension (department + cost centre) builder,
                             and a proportional-split allocator for the future
                             multi-cost-centre case (nothing uses >1 split yet
                             — today's data model is one dept/CC per employee).
  gl-accounts-config.ts       The chart-of-accounts mapping used by the journal
                             builder. Every code is tagged SOURCED (pulled from
                             the finance manager's reference workbook, via the
                             account numbers already shown in the payroll page's
                             GL tab) or ASSUMPTION (invented to make the journal
                             balance — needs finance confirmation before real
                             posting). See the file header for which is which.
  journal-builder.ts          buildPayrollJournal() — turns a payroll run into
                             balanced JournalLine[]. Expense lines are
                             dimensioned per cost centre; liability/payable
                             lines are booked to one company-wide Finance
                             dimension (PAYROLL_LIABILITY_DIMENSION).
  dynamics-ax-client.ts       createPayrollJournal() (pure payload transform)
                             and postPayrollJournal() (the actual HTTP call).
                             Self-mocking: returns a flagged mock response
                             when DYNAMICS_AX_* env vars aren't set.
  excel-ingest.ts             parsePayrollWorkbook()/parsePayrollWorksheet() —
                             header-driven Excel parsing (by column name, not
                             fixed position), generalized from
                             scripts/import-employees-to-supabase.js.
  __tests__/                  Jest tests for all of the above.

app/api/payroll/
  route.ts        GET employees, POST → run payroll engine, save to Supabase.
  post/route.ts   POST { month } → load that month's saved payroll_register_entries,
                  build the journal, post to AX (mocked or real).

app/(workspace)/payroll/page.tsx   UI. The "AX GL Posting" tab has a journal
                                   line preview + "Post to AX (Dynamics)" button.
```

## Running dev server and tests

```bash
npm run dev          # Next.js dev server
npm test             # Jest — runs lib/__tests__/**
npm run test:watch   # Jest watch mode
npx tsc --noEmit      # type-check without emitting
```

The payroll/AX modules have no UI dependency — `npm test` alone verifies the
engine, cost allocation, journal builder, and AX client without starting the
app.

## Adding a new statutory deduction or GL account

1. **New rate or band** (e.g. KRA changes a PAYE band, or NITA increases):
   edit `lib/payroll-rules-config.ts` only. `payroll-engine.ts` reads from
   this config — do not add new magic numbers there.
2. **New deduction type entirely** (e.g. a new government levy):
   - Add the rate to `payroll-rules-config.ts`.
   - Add the computation to `computePayroll()` in `payroll-engine.ts`,
     following the existing pattern (compute on the documented base — basic
     vs. gross matters, see that file's header comment for what's verified
     against the reference workbook).
   - Decide whether it needs its own GL account (see below) or folds into
     `otherDeductionsPayable`.
   - Add a test case to `lib/__tests__/payroll-engine.test.ts` with a
     hand-computed expected value (not just a snapshot — snapshots lock in
     bugs as easily as correct behavior).
3. **New GL account**: add it to `PAYROLL_GL_ACCOUNTS` in
   `lib/gl-accounts-config.ts`, tag it `SOURCED` (with where the code came
   from) or `ASSUMPTION` (and what needs finance confirmation), then wire it
   into `journal-builder.ts`'s `buildPayrollJournal()`. Add/update a test in
   `lib/__tests__/journal-builder.test.ts` asserting `totalDebit === totalCredit`
   still holds — an unbalanced journal is a hard failure, not a warning.

## Configuring the Dynamics AX integration

Without any `DYNAMICS_AX_*` environment variables set, `postPayrollJournal()`
returns a mocked success response (`isMock: true`) — this is the default,
expected state right now. To point it at a real AX/D365FO environment, add
to `.env.local`:

```env
DYNAMICS_AX_BASE_URL=https://<your-environment>.operations.dynamics.com
DYNAMICS_AX_AUTH_URL=https://login.microsoftonline.com/<tenant-id>/oauth2/token
DYNAMICS_AX_TENANT_ID=<tenant-id>
DYNAMICS_AX_CLIENT_ID=<app-registration-client-id>
DYNAMICS_AX_CLIENT_SECRET=<app-registration-client-secret>
DYNAMICS_AX_RESOURCE=https://<your-environment>.operations.dynamics.com   # optional, defaults to BASE_URL
DYNAMICS_AX_JOURNAL_ENTITY=GeneralJournalHeaders                          # optional, this is the default
DYNAMICS_AX_JOURNAL_LINE_ENTITY=GeneralJournalLines                       # optional, this is the default
DYNAMICS_AX_LEGAL_ENTITY=CHAF                                             # optional, this is the default
```

Before flipping this on for real:
- Confirm the actual entity names via a `/data/$metadata` call against the
  target environment — `GeneralJournalHeaders`/`GeneralJournalLines` are the
  typical D365FO public entity names but this varies by version/customization.
- Confirm how financial dimensions are actually expected on the wire in that
  environment (a `DefaultDimensionDisplayValue` string, a dimension-set ID, or
  discrete fields) — `lib/dynamics-ax-client.ts`'s `AxJournalLinePayload` uses
  placeholder `Department`/`CostCenter` fields that will very likely need
  adjusting.
- Get finance-manager sign-off on every account code tagged `ASSUMPTION` in
  `lib/gl-accounts-config.ts` — those don't exist in any real chart of
  accounts document I had access to; they were derived to make the journal
  balance, not sourced from AX.
- Register an AX/Entra app registration for the client-credentials OAuth flow
  and grant it the appropriate D365FO API permissions.

## Known assumptions still needing finance-manager confirmation

- **GL account codes**: see the `ASSUMPTION`-tagged entries in
  `lib/gl-accounts-config.ts` (PAYE Payable, Pension Payable, NITA Payable,
  Other Deductions Payable, Non-Cash Benefits Clearing). The existing payroll
  page's GL tab mock reused account 11500 for both Net Salaries Payable and
  KRA PAYE Payable, and never credited a payable for the Pension debit — both
  look like bugs in that mock rather than intentional shared accounts, so
  this rewrite gives each its own code instead of copying them.
- **NSSF/AHL employer-side cost**: `computePayroll()` only tracks one NSSF
  figure and one AHL figure (no separate employer-match amount for either,
  unlike pension which has explicit EE/ER fields) — the journal builder
  treats them as a single combined EE+ER liability funded entirely out of
  gross pay, with only pension and NITA treated as additional employer
  expense. Confirm this matches how Chrysal Africa actually remits NSSF/AHL.
- **Excel ingestion** (`lib/excel-ingest.ts`) generalizes the column-header
  parsing already used for the one-off employee import, but no separate
  "monthly variable inputs" template file exists in this repo to test it
  against for real — it's unit-tested against a synthetic in-memory
  worksheet matching the same header layout, not the finance manager's
  actual monthly file. No file-upload UI/endpoint has been wired yet either.
- **Multi-cost-centre cost splitting** (`allocateAcrossSplits` in
  `lib/cost-allocation.ts`) is built and tested but unused — today's employee
  data model has exactly one department/cost centre per employee. Wire it in
  if/when an employee needs to be split across centres.
