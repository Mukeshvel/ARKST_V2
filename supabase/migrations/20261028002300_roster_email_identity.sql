begin;
-- An approved address must identify at most one roster record, including history.
-- Existing rows are checked before the index so the migration never picks a winner.
do $$ begin
  if exists (select 1 from public.department_student_roster
    where institutional_email is not null
    group by lower(institutional_email) having count(*)>1) then
    raise exception 'Duplicate institutional roster emails require operator review.' using errcode='23505';
  end if;
end $$;
create unique index department_roster_unique_institutional_email
  on public.department_student_roster(lower(institutional_email))
  where institutional_email is not null;
commit;
