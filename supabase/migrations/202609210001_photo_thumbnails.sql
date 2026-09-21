-- Every wall photo now uploads a small companion for the grid: <user>/<photo>.thumb.jpg.
-- The full image (1600px) is only fetched when a guest opens it, cutting album egress ~25x.
alter policy "Upload private photo" on storage.objects with check(bucket_id='memories' and public.can_view_album() and public.uploads_are_open() and (storage.foldername(name))[1]=auth.uid()::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(\.thumb)?\.jpg$');

create or replace function public.delete_birthday_invitation(target uuid) returns void
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
  -- Queue the thumbnail next to each full photo so storage cleanup removes both.
  select coalesce(array_agg(p),'{}'::text[]) into paths from (
    select storage_path as p from public.photos where user_id=any(guests)
    union all select regexp_replace(storage_path,'\.jpg$','.thumb.jpg') from public.photos where user_id=any(guests)
  ) files;
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
