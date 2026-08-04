-- Two employees have AHL relief of zero in Tony's sheet, not the standard
-- 15% of their AHL contribution — found during the full 46-employee audit.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS ahl_relief_override numeric;
