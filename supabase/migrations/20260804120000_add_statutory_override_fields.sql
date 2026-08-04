-- A full 46-employee audit against Tony's actual computed figures (not just
-- spot-checks) found that `exclude_nssf_from_paye_bands` (a boolean) was too
-- narrow to represent his sheet's real per-employee quirks — some employees
-- use a different flat PAYE-band deduction amount (not just "on/off"), some
-- have 0% pension instead of the standard 5%, and a few have a non-flat
-- NSSF Tier II. Replacing the boolean with precise numeric overrides.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS paye_band_flat_deduction numeric,
  ADD COLUMN IF NOT EXISTS pension_rate_override numeric,
  ADD COLUMN IF NOT EXISTS nssf_t2_override numeric;

-- exclude_nssf_from_paye_bands is superseded by paye_band_flat_deduction
-- (set it to 20000 for the two employees that previously had the boolean
-- true) but the column is left in place rather than dropped — cheap to
-- keep, and dropping a column from a live table is the kind of change to
-- do deliberately, not as a side effect of an unrelated fix.
UPDATE public.employees
  SET paye_band_flat_deduction = 20000
  WHERE exclude_nssf_from_paye_bands = true AND paye_band_flat_deduction IS NULL;
