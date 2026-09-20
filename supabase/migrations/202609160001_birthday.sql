-- Apply to a new Supabase project. No service_role key belongs in the frontend.
create extension if not exists pgcrypto with schema extensions;

create table public.event_settings (
  id text primary key check (id = 'santiago-7'),
  starts_at timestamptz,
  ends_at timestamptz,
  uploads_open_at timestamptz not null default '2026-09-26 00:00 America/Santiago',
  uploads_close_at timestamptz not null default '2026-10-04 00:00 America/Santiago',
  uploads_enabled boolean not null default true,
  check (uploads_close_at > uploads_open_at),
  check (ends_at is null or (starts_at is not null and ends_at > starts_at))
);
insert into public.event_settings (id, starts_at, ends_at) values ('santiago-7', '2026-09-26 15:30 America/Santiago', '2026-09-26 19:00 America/Santiago');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  role text not null default 'guest' check (role in ('guest','admin')),
  created_at timestamptz not null default now()
);
create table public.event_details (
  id text primary key references public.event_settings(id),
  venue text not null default '' check (char_length(venue) <= 160),
  address text not null default '' check (char_length(address) <= 300),
  map_url text not null default '' check (map_url = '' or map_url like 'https://%')
);
insert into public.event_details (id, venue, address, map_url) values (
  'santiago-7', '¡Nos vemos en La Serena!', 'Nicaragua 1913, La Serena, Coquimbo',
  'https://www.google.com/maps/search/?api=1&query=Nicaragua%201913%2C%20La%20Serena%2C%20Coquimbo'
);
create table public.rsvps (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  family_name text not null check (char_length(trim(family_name)) between 2 and 80),
  attending boolean not null,
  adults integer not null,
  children integer not null,
  note text not null default '' check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  check ((attending and adults between 1 and 20 and children between 0 and 20) or (not attending and adults = 0 and children = 0))
);
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id),
  storage_path text unique not null,
  caption text not null default '' check (char_length(caption) <= 500),
  created_at timestamptz not null default now()
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id),
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create table public.likes (
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id),
  primary key (photo_id, user_id)
);
create index photos_feed on public.photos(created_at desc, id desc);
create index comments_photo on public.comments(photo_id, created_at);
create index photos_owner on public.photos(user_id);
create index comments_owner on public.comments(user_id);
create index likes_owner on public.likes(user_id);

-- A non-exposed schema holds the hashed invitation code and join throttling.
create schema if not exists birthday_private;
revoke all on schema birthday_private from public, anon, authenticated;
create table birthday_private.invitation (id boolean primary key default true check (id), code_hash text not null);
create table birthday_private.join_attempts (user_id uuid primary key references auth.users(id) on delete cascade, attempted_at timestamptz not null);

create function public.is_guest() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where user_id = (select auth.uid()));
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where user_id = (select auth.uid()) and role = 'admin');
$$;
create function public.uploads_are_open() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.event_settings where id = 'santiago-7' and uploads_enabled and now() >= uploads_open_at and now() < uploads_close_at);
$$;
create function public.join_party(invite_code text, guest_name text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare last_attempt timestamptz;
begin
  if auth.uid() is null then raise exception 'Inicia una sesión para continuar.'; end if;
  if char_length(trim(guest_name)) not between 2 and 80 then raise exception 'Escribe tu nombre (2 a 80 caracteres).'; end if;
  if char_length(invite_code) > 128 then return false; end if;
  if public.is_guest() then return true; end if;
  -- Serialize concurrent requests from the same identity.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select attempted_at into last_attempt from birthday_private.join_attempts where user_id = auth.uid();
  if last_attempt > now() - interval '3 seconds' then return false; end if;
  insert into birthday_private.join_attempts values (auth.uid(), now()) on conflict (user_id) do update set attempted_at = excluded.attempted_at;
  if not exists(select 1 from birthday_private.invitation where code_hash = extensions.crypt(trim(invite_code), code_hash)) then return false; end if;
  insert into public.profiles(user_id, display_name) values (auth.uid(), trim(guest_name));
  return true;
end;
$$;
create function public.set_invitation_code(new_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acceso reservado a la organización.'; end if;
  if char_length(new_code) not between 10 and 128 then raise exception 'Usa un código de 10 a 128 caracteres.'; end if;
  insert into birthday_private.invitation(id, code_hash) values (true, extensions.crypt(trim(new_code), extensions.gen_salt('bf')))
  on conflict (id) do update set code_hash = excluded.code_hash;
end;
$$;

alter table public.event_settings enable row level security;
alter table public.event_details enable row level security;
alter table public.profiles enable row level security;
alter table public.rsvps enable row level security;
alter table public.photos enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
create policy "Public schedule" on public.event_settings for select to anon, authenticated using (true);
create policy "Admin schedule" on public.event_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Guest details" on public.event_details for select to authenticated using (public.is_guest());
create policy "Admin details" on public.event_details for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Guest names" on public.profiles for select to authenticated using (public.is_guest());
-- No direct INSERT/UPDATE privileges on profiles: a guest cannot grant admin status.
create policy "Own RSVP or admin" on public.rsvps for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Create own RSVP" on public.rsvps for insert to authenticated with check (public.is_guest() and user_id = auth.uid());
create policy "Update own RSVP" on public.rsvps for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Guest photos" on public.photos for select to authenticated using (public.is_guest());
create policy "Publish own photo" on public.photos for insert to authenticated with check (
  public.is_guest() and public.uploads_are_open() and user_id = auth.uid()
  and storage_path = auth.uid()::text || '/' || id::text || '.jpg'
  and exists(select 1 from storage.objects where bucket_id = 'memories' and name = storage_path)
);
create policy "Remove own photo or moderate" on public.photos for delete to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Guest comments" on public.comments for select to authenticated using (public.is_guest());
create policy "Publish comment" on public.comments for insert to authenticated with check (public.is_guest() and public.uploads_are_open() and user_id = auth.uid());
create policy "Remove comment or moderate" on public.comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Guest likes" on public.likes for select to authenticated using (public.is_guest());
create policy "Like photo" on public.likes for insert to authenticated with check (public.is_guest() and public.uploads_are_open() and user_id = auth.uid());
create policy "Unlike photo" on public.likes for delete to authenticated using (user_id = auth.uid());

revoke all on public.profiles, public.event_settings, public.event_details, public.rsvps, public.photos, public.comments, public.likes from anon, authenticated;
grant select on public.event_settings to anon, authenticated;
grant update on public.event_settings, public.event_details to authenticated;
grant select on public.event_details, public.profiles, public.rsvps, public.photos, public.comments, public.likes to authenticated;
grant insert, update on public.rsvps to authenticated;
grant insert, delete on public.photos, public.comments, public.likes to authenticated;
revoke all on function public.is_guest(), public.is_admin(), public.uploads_are_open(), public.join_party(text,text), public.set_invitation_code(text) from public;
grant execute on function public.is_guest(), public.is_admin(), public.uploads_are_open(), public.join_party(text,text), public.set_invitation_code(text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('memories', 'memories', false, 5242880, array['image/jpeg']);
create policy "Read private memories" on storage.objects for select to authenticated using (bucket_id = 'memories' and public.is_guest());
create policy "Upload private photo" on storage.objects for insert to authenticated with check (
  bucket_id = 'memories' and public.is_guest() and public.uploads_are_open()
  and (storage.foldername(name))[1] = auth.uid()::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
);
create policy "Remove own upload or moderate" on storage.objects for delete to authenticated using (
  bucket_id = 'memories' and (public.is_admin() or (public.is_guest() and (storage.foldername(name))[1] = auth.uid()::text))
);

-- Realtime respects SELECT RLS. The frontend also refreshes periodically.
alter publication supabase_realtime add table public.photos, public.comments, public.likes;
