create function public.generate_themed_guest_code() returns text
language plpgsql volatile set search_path='' as $$
declare
  names text[] := array['Rex','Triceratops','Velociraptor','Espinosaurio','Diplodocus','Estegosaurio','Anquilosaurio','Pteranodon','Brachiosaurio','Carnotauro','Mosasaurio','Parasaurolophus','Creeper','Steve','Alex','Enderman','Axolote','Allay','Golem','Diamante','Redstone','Esmeralda','Nether','Lobo','Sonic','Tails','Knuckles','Amy','Silver','Shadow','Chao','Anillo'];
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea := extensions.gen_random_bytes(9);
  suffix text := '';
begin
  for n in 1..8 loop suffix := suffix || substr(alphabet,1+(get_byte(random_bytes,n)%32),1); end loop;
  return 'Santiago-' || names[1+(get_byte(random_bytes,0)%array_length(names,1))] || '-' || suffix;
end;
$$;
create table birthday_private.legacy_invitation_codes (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  code text not null unique
);
revoke all on birthday_private.legacy_invitation_codes from public,anon,authenticated;
alter table birthday_private.legacy_invitation_codes enable row level security;
insert into birthday_private.legacy_invitation_codes(invitation_id,code) select id,access_code from public.invitations;
alter table public.invitations alter column access_code set default public.generate_themed_guest_code();
update public.invitations set access_code=public.generate_themed_guest_code();
create unique index invitations_code_normalized on public.invitations(upper(regexp_replace(access_code,'[[:space:]-]','','g')));

create or replace function public.resolve_guest_code(guest_code text) returns text
language plpgsql security definer set search_path='' as $$
declare result text; last_attempt timestamptz; normalized text;
begin
  if auth.uid() is null or length(guest_code)>100 then return null; end if;
  normalized := upper(regexp_replace(guest_code,'[[:space:]-]','','g'));
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select attempted_at into last_attempt from birthday_private.join_attempts where user_id=auth.uid();
  if last_attempt>now()-interval '3 seconds' then return null; end if;
  insert into birthday_private.join_attempts values(auth.uid(),now()) on conflict(user_id) do update set attempted_at=excluded.attempted_at;
  select i.token into result from public.invitations i
  where i.active and (upper(regexp_replace(i.access_code,'[[:space:]-]','','g'))=normalized
    or exists(select 1 from birthday_private.legacy_invitation_codes old where old.invitation_id=i.id and upper(regexp_replace(old.code,'[[:space:]-]','','g'))=normalized));
  return result;
end;
$$;
create or replace function public.unlock_personal_album(guest_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare invitation uuid; normalized text;
begin
  if auth.uid() is null or length(guest_code)>100 then return false; end if;
  normalized := upper(regexp_replace(guest_code,'[[:space:]-]','','g'));
  select i.id into invitation from public.invitations i join public.profiles p on p.invitation_id=i.id
  where p.user_id=auth.uid() and i.active and (upper(regexp_replace(i.access_code,'[[:space:]-]','','g'))=normalized
    or exists(select 1 from birthday_private.legacy_invitation_codes old where old.invitation_id=i.id and upper(regexp_replace(old.code,'[[:space:]-]','','g'))=normalized));
  if invitation is null then return false; end if;
  update public.profiles set album_verified=true where user_id=auth.uid();
  return true;
end;
$$;
