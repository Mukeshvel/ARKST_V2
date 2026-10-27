begin;

-- The RPC is the normal entry point, but table constraints must also reject
-- duplicate subjects when an authenticated caller invokes it directly.
create or replace function activity_private.valid_subjects(p_subjects text[]) returns boolean
language sql immutable set search_path = '' as $$
 select p_subjects is not null and cardinality(p_subjects)<=20
   and array_position(p_subjects,null) is null
   and not exists(select 1 from unnest(p_subjects) s where char_length(btrim(s)) not between 1 and 100)
   and cardinality(p_subjects)=(select count(distinct lower(btrim(s))) from unnest(p_subjects) s)
$$;

notify pgrst,'reload schema';
commit;
