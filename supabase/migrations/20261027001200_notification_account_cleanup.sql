begin;

-- Removing a test or deprovisioned account removes its private inbox and
-- undelivered outbox records. Normal Activity/announcement history is separate.
alter table public.notifications drop constraint notifications_recipient_id_fkey;
alter table public.notifications add constraint notifications_recipient_id_fkey
  foreign key(recipient_id) references public.profiles(id) on delete cascade;
alter table public.notification_outbox drop constraint notification_outbox_notification_id_fkey;
alter table public.notification_outbox add constraint notification_outbox_notification_id_fkey
  foreign key(notification_id) references public.notifications(id) on delete cascade;

commit;
