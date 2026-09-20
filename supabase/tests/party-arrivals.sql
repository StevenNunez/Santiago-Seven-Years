begin;
do $$
declare guest uuid:=gen_random_uuid(); second_guest uuid:=gen_random_uuid(); invitation uuid:=gen_random_uuid(); other_inv uuid:=gen_random_uuid(); first_time timestamptz;
begin
  insert into auth.users(id) values(guest),(second_guest);
  insert into public.invitations(id,recipient_name) values(invitation,'Llegada demo'),(other_inv,'Otro demo');
  insert into public.profiles(user_id,display_name,role,invitation_id,album_verified) values(guest,'Llegada demo','guest',invitation,true),(second_guest,'Otro demo','guest',other_inv,true);
  perform set_config('request.jwt.claims',json_build_object('sub',guest,'role','authenticated')::text,true);
  update public.event_settings set album_test_mode=false,uploads_enabled=true,uploads_open_at=now()+interval '1 hour',uploads_close_at=now()+interval '8 days',starts_at=now()+interval '1 hour',ends_at=now()+interval '4 hours' where id='santiago-7';
  if public.can_view_album() or public.uploads_are_open() or public.arrive_at_party(2,1) then raise exception 'FAIL early access';end if;
  update public.event_settings set uploads_open_at=now(),starts_at=now() where id='santiago-7';
  if not public.can_view_album() or not public.uploads_are_open() or not public.arrive_at_party(2,1) then raise exception 'FAIL opening boundary';end if;
  select checked_in_at into first_time from public.invitations where id=invitation;
  if not exists(select 1 from public.get_my_arrival() where checked_in_adults=2 and checked_in_children=1) then raise exception 'FAIL arrival persistence';end if;
  perform public.arrive_at_party(3,2);
  if not exists(select 1 from public.invitations where id=invitation and checked_in_at=first_time and checked_in_adults=3 and checked_in_children=2) then raise exception 'FAIL duplicate/correction';end if;
  if exists(select 1 from public.invitations where id=other_inv and checked_in_at is not null) then raise exception 'FAIL other family';end if;
  begin perform public.arrive_at_party(0,5);raise exception 'FAIL invalid count';exception when others then if sqlerrm='FAIL invalid count' then raise;end if;end;
  update public.event_settings set starts_at=now()-interval '4 hours',ends_at=now() where id='santiago-7';
  if public.arrive_at_party(4,3) then raise exception 'FAIL closing boundary';end if;
  update public.event_settings set uploads_open_at=now()-interval '8 days',uploads_close_at=now() where id='santiago-7';
  if public.uploads_are_open() or not public.can_view_album() then raise exception 'FAIL archive after upload close';end if;
  update public.invitations set active=false where id=invitation;
  if public.can_view_album() or exists(select 1 from public.get_my_arrival()) then raise exception 'FAIL revoked access';end if;
  if has_column_privilege('authenticated','public.invitations','checked_in_adults','UPDATE') or has_function_privilege('anon','public.arrive_at_party(integer,integer)','EXECUTE') then raise exception 'FAIL arrival privileges';end if;
end $$;
select 'PASS: album opening/closing, arrival start/end, counts, repeat registration, other-family isolation and revocation' as result;
rollback;
