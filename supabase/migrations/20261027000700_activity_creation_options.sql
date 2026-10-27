begin;

-- Only current CREATE approvals are exposed. These rows drive the form; the
-- publication RPC remains the authority and rechecks all grants and recipients.
create function public.activity_creation_options()
returns table(
  department_id uuid,
  department_name text,
  section_id uuid,
  section_name text,
  category_key text,
  category_label text,
  eligible_count bigint
)
language sql stable security definer set search_path = '' as $$
  select d.id,d.name,s.id,s.name,c.key,c.label,
    (select count(*) from public.department_student_roster roster
      join public.profiles p on p.id=roster.linked_student_id
        and p.is_active and p.account_kind='student'
      where roster.department_scope_id=d.id and roster.section_scope_id=s.id
        and roster.active and exists (
          select 1 from public.student_scope_memberships m
          where m.student_id=roster.linked_student_id and m.scope_id=s.id
            and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
        ))
  from public.scopes d
  join public.scopes s on s.parent_id=d.id and s.kind='section'
  cross join public.activity_categories c
  where d.kind='department' and activity_private.active_kind()='staff'
    and activity_private.can_manage(s.id,c.key,'create')
  order by d.name,d.id,s.name,s.id,c.label,c.key
$$;

revoke all on function public.activity_creation_options() from public,anon,authenticated;
grant execute on function public.activity_creation_options() to authenticated;
notify pgrst,'reload schema';
commit;
