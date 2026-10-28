begin;
create table public.trusted_operator_history (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null check (operation in ('activity_grant','responsibility_add','responsibility_end','escalation_route')),
  entity_id uuid not null,
  before_value jsonb not null default '{}'::jsonb check (jsonb_typeof(before_value)='object'),
  after_value jsonb not null default '{}'::jsonb check (jsonb_typeof(after_value)='object'),
  occurred_at timestamptz not null default now()
);
create index trusted_operator_history_entity on public.trusted_operator_history(operation,entity_id,occurred_at desc);
alter table public.trusted_operator_history enable row level security;
revoke all on public.trusted_operator_history from public,anon,authenticated;
revoke all on sequence public.trusted_operator_history_id_seq from public,anon,authenticated;
grant select,insert on public.trusted_operator_history to service_role;
grant usage,select on sequence public.trusted_operator_history_id_seq to service_role;
commit;
