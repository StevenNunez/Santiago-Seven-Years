-- "Niveles anteriores": the organizer's retrospective slideshow projected at the party.
-- Only the organizer can read it; a local script writes it with the service role.
create table public.moments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('photo','video','music')),
  position integer not null,
  storage_path text not null unique,
  poster_path text,
  caption text not null default '' check (char_length(caption) <= 200),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  width integer, height integer,
  bytes integer not null default 0,
  source_hash text not null,
  created_at timestamptz not null default now(),
  unique (kind, position)
);
alter table public.moments enable row level security;
revoke all on public.moments from public, anon, authenticated;
grant select on public.moments to authenticated;
create policy "Organizer moments" on public.moments for select to authenticated using (public.is_admin());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('moments', 'moments', false, 52428800, array['image/webp','video/mp4','audio/mp4']);
create policy "Organizer reads moments" on storage.objects for select to authenticated using (bucket_id='moments' and public.is_admin());
