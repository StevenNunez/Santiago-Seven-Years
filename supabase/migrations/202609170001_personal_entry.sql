alter table public.invitations add column access_code text not null unique default upper(encode(extensions.gen_random_bytes(10), 'hex'));
alter table public.invitations add column checked_in_at timestamptz;
alter table public.profiles add column album_verified boolean not null default false;

create function public.resolve_invitation_entry(invite_token text)
returns table(id uuid, recipient_name text, venue text, address text, map_url text, access_code text, attending boolean)
language sql stable security definer set search_path = '' as $$
  select i.id,i.recipient_name,d.venue,d.address,d.map_url,i.access_code,r.attending
  from public.invitations i cross join public.event_details d left join public.rsvps r on r.invitation_id=i.id
  where i.token=invite_token and i.active and d.id='santiago-7';
$$;
create function public.resolve_guest_code(guest_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare result text; last_attempt timestamptz;
begin
  if auth.uid() is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select attempted_at into last_attempt from birthday_private.join_attempts where user_id=auth.uid();
  if last_attempt > now()-interval '3 seconds' then return null; end if;
  insert into birthday_private.join_attempts values(auth.uid(),now()) on conflict(user_id) do update set attempted_at=excluded.attempted_at;
  select token into result from public.invitations where active and access_code=upper(regexp_replace(guest_code,'[[:space:]-]','','g'));
  return result;
end;
$$;
create function public.unlock_personal_album(guest_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare invitation uuid;
begin
  if auth.uid() is null then return false; end if;
  select i.id into invitation from public.invitations i join public.profiles p on p.invitation_id=i.id
    where p.user_id=auth.uid() and i.active and i.access_code=upper(regexp_replace(guest_code,'[[:space:]-]','','g'));
  if invitation is null then return false; end if;
  update public.profiles set album_verified=true where user_id=auth.uid();
  return true;
end;
$$;
create function public.can_view_album() returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists(select 1 from public.profiles p join public.invitations i on i.id=p.invitation_id where p.user_id=auth.uid() and p.album_verified and i.active);
$$;
create function public.arrive_at_party() returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_view_album() or public.is_admin() then return false; end if;
  if not exists(select 1 from public.event_settings where id='santiago-7' and now()>=uploads_open_at and now()<uploads_open_at+interval '1 day') then return false; end if;
  update public.invitations set checked_in_at=coalesce(checked_in_at,now()) where id=public.my_invitation_id();
  return found;
end;
$$;
-- Invitation identity is authoritative for RSVP and photo attribution.
create function birthday_private.bind_invitation_name() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.invitation_id is not null then
    if tg_table_name='rsvps' then select recipient_name into new.family_name from public.invitations where id=new.invitation_id;
    else select recipient_name into new.display_name from public.invitations where id=new.invitation_id; end if;
  end if;
  return new;
end;
$$;
create trigger invitation_rsvp_name before insert or update on public.rsvps for each row execute function birthday_private.bind_invitation_name();
create trigger invitation_profile_name before insert or update on public.profiles for each row execute function birthday_private.bind_invitation_name();
update public.profiles p set display_name=i.recipient_name from public.invitations i where p.invitation_id=i.id;
update public.rsvps r set family_name=i.recipient_name from public.invitations i where r.invitation_id=i.id;

alter policy "Guest photos" on public.photos using(public.can_view_album());
alter policy "Publish own photo" on public.photos with check(public.can_view_album() and public.uploads_are_open() and user_id=auth.uid() and storage_path=auth.uid()::text||'/'||id::text||'.jpg' and exists(select 1 from storage.objects where bucket_id='memories' and name=storage_path));
alter policy "Guest comments" on public.comments using(public.can_view_album());
alter policy "Publish comment" on public.comments with check(public.can_view_album() and public.uploads_are_open() and user_id=auth.uid());
alter policy "Guest likes" on public.likes using(public.can_view_album());
alter policy "Like photo" on public.likes with check(public.can_view_album() and public.uploads_are_open() and user_id=auth.uid());
alter policy "Read private memories" on storage.objects using(bucket_id='memories' and public.can_view_album());
alter policy "Upload private photo" on storage.objects with check(bucket_id='memories' and public.can_view_album() and public.uploads_are_open() and (storage.foldername(name))[1]=auth.uid()::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
alter policy "Guest names" on public.profiles using(user_id=auth.uid() or public.can_view_album());
revoke all on function public.resolve_invitation_entry(text),public.resolve_guest_code(text),public.unlock_personal_album(text),public.can_view_album(),public.arrive_at_party() from public;
grant execute on function public.resolve_invitation_entry(text) to anon,authenticated;
grant execute on function public.resolve_guest_code(text),public.unlock_personal_album(text),public.can_view_album(),public.arrive_at_party() to authenticated;
-- New entries use individual invitations, never a shared code and chosen name.
revoke execute on function public.join_party(text,text) from authenticated;
