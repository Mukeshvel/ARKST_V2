begin;

-- Trusted current counselor mappings may see a student's own catch-up request
-- and its attention flag. Publication/review still requires general CREATE.
create or replace function activity_private.can_view_catch_up(p_request uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.catch_up_requests c where c.id=p_request and
    ((c.student_id=auth.uid() and activity_private.active_kind()='student')
      or activity_private.can_review_catch_up(c.id)
      or (activity_private.active_kind()='staff' and activity_private.can_see_roster(c.roster_id))))
$$;

commit;
