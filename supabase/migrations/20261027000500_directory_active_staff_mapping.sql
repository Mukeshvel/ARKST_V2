begin;

-- Direct mapping reads must honor staff deactivation as roster reads already do.
alter policy own_counselor_mappings on public.counselor_student_mappings
  using (activity_private.active_kind()='staff' and exists(
    select 1 from public.responsibility_assignments r
    join public.department_student_roster s on s.id=roster_student_id
    where r.id=counselor_responsibility_id and r.user_id=auth.uid() and r.role='counselor'
      and s.active and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
  ) and starts_at<=now() and (ends_at is null or now()<ends_at));

commit;
