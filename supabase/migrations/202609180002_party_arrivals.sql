alter table public.invitations add column checked_in_adults integer not null default 0 check(checked_in_adults between 0 and 20);
alter table public.invitations add column checked_in_children integer not null default 0 check(checked_in_children between 0 and 20);
create or replace function public.can_view_album() returns boolean language sql stable security definer set search_path='' as $$
  select public.is_admin() or (
    exists(select 1 from public.event_settings where id='santiago-7' and (album_test_mode or now()>=uploads_open_at))
    and exists(select 1 from public.profiles p join public.invitations i on i.id=p.invitation_id where p.user_id=auth.uid() and p.album_verified and i.active)
  );
$$;
drop function public.arrive_at_party();
create function public.arrive_at_party(actual_adults integer default 1, actual_children integer default 0)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not public.is_guest() or public.is_admin() then return false; end if;
  if actual_adults is null or actual_children is null or actual_adults<1 or actual_adults>20 or actual_children<0 or actual_children>20 then
    raise exception 'Indica entre 1 y 20 adultos y entre 0 y 20 niños.';
  end if;
  if not exists(select 1 from public.event_settings where id='santiago-7' and now()>=starts_at and now()<ends_at) then return false; end if;
  update public.invitations set checked_in_at=coalesce(checked_in_at,now()),checked_in_adults=actual_adults,checked_in_children=actual_children
    where id=public.my_invitation_id() and active;
  return found;
end;
$$;
create function public.get_my_arrival() returns table(checked_in_at timestamptz,checked_in_adults integer,checked_in_children integer)
language sql stable security definer set search_path='' as $$
  select i.checked_in_at,i.checked_in_adults,i.checked_in_children from public.invitations i
    where public.is_guest() and i.id=public.my_invitation_id() and i.active;
$$;
revoke all on function public.arrive_at_party(integer,integer), public.get_my_arrival() from public,anon;
grant execute on function public.arrive_at_party(integer,integer), public.get_my_arrival() to authenticated;
