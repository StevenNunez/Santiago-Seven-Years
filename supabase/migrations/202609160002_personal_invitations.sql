create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  recipient_name text not null check (char_length(trim(recipient_name)) between 2 and 80),
  email text not null default '' check (char_length(email) <= 254 and (email = '' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  phone text not null default '' check (phone = '' or phone ~ '^\+?[1-9][0-9]{7,14}$'),
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  email_last_attempt_at timestamptz,
  email_sent_at timestamptz
);
alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to authenticated;
grant insert(recipient_name, email, phone) on public.invitations to authenticated;
grant update(recipient_name, email, phone, active) on public.invitations to authenticated;
create policy "Organizer invitations" on public.invitations for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.profiles add column invitation_id uuid references public.invitations(id);
create index profiles_invitation on public.profiles(invitation_id);
alter table public.rsvps add column invitation_id uuid references public.invitations(id);
create unique index rsvps_one_per_invitation on public.rsvps(invitation_id) where invitation_id is not null;

create or replace function public.is_guest() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.user_id = (select auth.uid())
    and (p.invitation_id is null or exists(select 1 from public.invitations i where i.id = p.invitation_id and i.active)));
$$;
create function public.my_invitation_id() returns uuid language sql stable security definer set search_path = '' as $$
  select invitation_id from public.profiles where user_id = (select auth.uid()) and public.is_guest();
$$;

-- A bearer link reveals only that invitation's name and event details, never
-- email/phone, other invitees or the album. The token has 256 bits of entropy.
create function public.resolve_invitation(invite_token text)
returns table(id uuid, recipient_name text, venue text, address text, map_url text)
language sql stable security definer set search_path = '' as $$
  select i.id, i.recipient_name, d.venue, d.address, d.map_url
  from public.invitations i cross join public.event_details d
  where i.token = invite_token and i.active and d.id = 'santiago-7';
$$;
create function public.join_invitation(invite_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare invited public.invitations; current_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'Inicia una sesión para continuar.'; end if;
  select * into invited from public.invitations where token = invite_token and active for share;
  if not found then raise exception 'Este enlace ya no está disponible. Pide una nueva invitación.'; end if;
  select * into current_profile from public.profiles where user_id = auth.uid() for update;
  if found and (current_profile.role = 'admin' or (current_profile.invitation_id is not null and current_profile.invitation_id <> invited.id)) then
    raise exception 'Abre este enlace en una sesión de invitado independiente.';
  end if;
  insert into public.profiles(user_id, display_name, invitation_id)
    values (auth.uid(), invited.recipient_name, invited.id)
    on conflict(user_id) do update set invitation_id = excluded.invitation_id;
  return true;
end;
$$;

drop policy "Own RSVP or admin" on public.rsvps;
create policy "Own RSVP or admin" on public.rsvps for select to authenticated using (
  public.is_admin() or (public.is_guest() and (user_id = auth.uid() or invitation_id = public.my_invitation_id()))
);
drop policy "Create own RSVP" on public.rsvps;
create policy "Create own RSVP" on public.rsvps for insert to authenticated with check (
  public.is_guest() and user_id = auth.uid() and invitation_id is not distinct from public.my_invitation_id()
);
drop policy "Update own RSVP" on public.rsvps;
create policy "Update own RSVP" on public.rsvps for update to authenticated using (
  public.is_guest() and user_id = auth.uid()
) with check (public.is_guest() and user_id = auth.uid() and invitation_id is not distinct from public.my_invitation_id());

create function public.get_my_rsvp() returns setof public.rsvps language sql stable security definer set search_path = '' as $$
  select r.* from public.rsvps r where public.is_guest() and
    ((public.my_invitation_id() is not null and r.invitation_id = public.my_invitation_id())
      or (public.my_invitation_id() is null and r.user_id = auth.uid()));
$$;
create function public.save_my_rsvp(family_name text, attending boolean, adults integer, children integer, note text)
returns void language plpgsql security definer set search_path = '' as $$
declare invitation uuid := public.my_invitation_id(); existing_user uuid;
begin
  if not public.is_guest() then raise exception 'Abre tu invitación para confirmar.'; end if;
  if invitation is not null then
    -- All devices using the same family link update a single RSVP.
    perform pg_advisory_xact_lock(hashtextextended(invitation::text, 1));
    select r.user_id into existing_user from public.rsvps r where r.invitation_id = invitation;
  end if;
  insert into public.rsvps(user_id, invitation_id, family_name, attending, adults, children, note, updated_at)
    values (coalesce(existing_user, auth.uid()), invitation, trim(family_name), attending,
      case when attending then adults else 0 end, case when attending then children else 0 end, note, now())
  on conflict(user_id) do update set invitation_id = excluded.invitation_id,
    family_name = excluded.family_name, attending = excluded.attending, adults = excluded.adults,
    children = excluded.children, note = excluded.note, updated_at = excluded.updated_at;
end;
$$;

-- The mail server calls this using the organizer's verified JWT. Atomic cooldown.
create function public.claim_invitation_email(invitation uuid) returns setof public.invitations
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acceso reservado a la organización.'; end if;
  return query update public.invitations set email_last_attempt_at = now()
    where id = invitation and active and email <> ''
      and (email_last_attempt_at is null or email_last_attempt_at < now() - interval '1 minute') returning *;
end;
$$;
revoke all on function public.my_invitation_id(), public.resolve_invitation(text), public.join_invitation(text), public.get_my_rsvp(), public.save_my_rsvp(text,boolean,integer,integer,text), public.claim_invitation_email(uuid) from public;
grant execute on function public.resolve_invitation(text) to anon, authenticated;
grant execute on function public.my_invitation_id(), public.join_invitation(text), public.get_my_rsvp(), public.save_my_rsvp(text,boolean,integer,integer,text), public.claim_invitation_email(uuid) to authenticated;
