-- Cleanup jobs survive partial failures in external storage / Wallet services.
create table public.invitation_cleanup (
  invitation_id uuid primary key,
  recipient_name text not null,
  storage_paths text[] not null default '{}',
  wallet_serial text,
  created_at timestamptz not null default now()
);
alter table public.invitation_cleanup enable row level security;
revoke all on public.invitation_cleanup from public, anon, authenticated;
grant select,update,delete on public.invitation_cleanup to service_role;

create function public.delete_birthday_invitation(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare person public.invitations; guests uuid[]; paths text[]; serial text;
begin
  if not public.is_admin() then raise exception 'Solo la organización puede eliminar invitaciones.'; end if;
  select * into person from public.invitations where id=target for update;
  if not found then return; end if;
  if exists(select 1 from public.wallet_passes where invitation_id=target and status='pending') then
    raise exception 'El pase Wallet aún se está preparando. Espera antes de eliminar.';
  end if;
  if exists(select 1 from public.profiles where invitation_id=target and role='admin') then
    raise exception 'No se puede eliminar una invitación vinculada a la organización.';
  end if;
  select coalesce(array_agg(user_id),'{}'::uuid[]) into guests from public.profiles where invitation_id=target;
  select coalesce(array_agg(storage_path),'{}'::text[]) into paths from public.photos where user_id=any(guests);
  select serial_number into serial from public.wallet_passes where invitation_id=target;
  insert into public.invitation_cleanup(invitation_id,recipient_name,storage_paths,wallet_serial)
    values(target,person.recipient_name,paths,serial);
  delete from public.comments where user_id=any(guests);
  delete from public.likes where user_id=any(guests);
  -- Photo foreign keys cascade its remaining comments and reactions.
  delete from public.photos where user_id=any(guests);
  delete from public.rsvps where invitation_id=target or user_id=any(guests);
  -- Never detach a profile into legacy guest access. Remove its access entirely.
  delete from public.profiles where user_id=any(guests);
  delete from public.invitations where id=target;
end;
$$;
revoke all on function public.delete_birthday_invitation(uuid) from public,anon;
grant execute on function public.delete_birthday_invitation(uuid) to authenticated;
