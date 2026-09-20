alter table public.event_settings add column album_test_mode boolean not null default false;
create or replace function public.uploads_are_open() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.event_settings where id='santiago-7' and uploads_enabled
    and (album_test_mode or (now() >= uploads_open_at and now() < uploads_close_at)));
$$;
-- Keep the real celebration dates intact; only open publication for testing.
update public.event_settings set album_test_mode=true, uploads_enabled=true where id='santiago-7';
