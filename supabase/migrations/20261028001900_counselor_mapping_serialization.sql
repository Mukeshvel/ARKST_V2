begin;

-- The existing GiST exclusion constraint rejects overlapping primary mappings.
-- Two concurrent inserts could deadlock inside that constraint on this local PG.
-- Acquire one transaction advisory lock before any mapping row is touched, so
-- the second writer observes the committed row and receives the normal 23P01.
create function activity_private.serialize_counselor_mutations() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(7013098798243::bigint);
  return null;
end $$;
create trigger counselor_mapping_serialize
  before insert or update or delete on public.counselor_student_mappings
  for each statement execute function activity_private.serialize_counselor_mutations();
revoke all on function activity_private.serialize_counselor_mutations() from public,anon,authenticated;
commit;
