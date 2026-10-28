begin;

-- PostgreSQL evaluates policy predicates as the querying role. These helpers
-- expose only booleans, keep fixed search paths, and are not in the REST schema.
grant execute on function activity_private.can_view_follow_up(uuid),
  activity_private.can_view_catch_up(uuid),
  activity_private.can_view_escalation(uuid) to authenticated;

commit;
