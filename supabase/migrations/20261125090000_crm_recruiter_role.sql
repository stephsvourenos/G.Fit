-- Creator Acquisition CRM (25 Nov 2026): a "Recruiter" staff role for people who research and contact creator prospects.
-- Recruiters can view, edit, import and contact prospects. Exporting, CRM settings, stage overrides and the audit
-- log stay with admins. (Added on its own because a new enum value can't be used in the same migration.)
alter type public.staff_role add value if not exists 'recruiter';
