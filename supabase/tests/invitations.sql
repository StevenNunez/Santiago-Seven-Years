begin;
select set_config('birthday.link_guest_a', gen_random_uuid()::text, true);
select set_config('birthday.link_guest_b', gen_random_uuid()::text, true);
select set_config('birthday.link_guest_other', gen_random_uuid()::text, true);
select set_config('birthday.link_invite', gen_random_uuid()::text, true);
select set_config('birthday.link_other_invite', gen_random_uuid()::text, true);
select set_config('birthday.link_token', encode(extensions.gen_random_bytes(32), 'hex'), true);
select set_config('birthday.other_token', encode(extensions.gen_random_bytes(32), 'hex'), true);
insert into auth.users(id) values (current_setting('birthday.link_guest_a')::uuid), (current_setting('birthday.link_guest_b')::uuid), (current_setting('birthday.link_guest_other')::uuid);
insert into public.invitations(id, recipient_name, email, token) values
  (current_setting('birthday.link_invite')::uuid, 'Familia prueba enlace', 'test@example.invalid', current_setting('birthday.link_token')),
  (current_setting('birthday.link_other_invite')::uuid, 'Otra familia prueba', '', current_setting('birthday.other_token'));

set local role anon;
do $$ begin
  if (select count(*) from public.resolve_invitation(current_setting('birthday.link_token'))) <> 1 then raise exception 'FAIL: link resolution'; end if;
  if exists(select 1 from public.resolve_invitation('not-a-real-token')) then raise exception 'FAIL: invalid token'; end if;
  begin
    perform * from public.invitations;
    raise exception 'FAIL: public contact list';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('birthday.link_guest_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.join_invitation(current_setting('birthday.link_token'));
select public.save_my_rsvp('Familia prueba enlace', true, 2, 1, 'Prueba temporal');
do $$ begin
  if (select children from public.get_my_rsvp()) <> 1 then raise exception 'FAIL: first device RSVP'; end if;
  if exists(select 1 from public.invitations) then raise exception 'FAIL: guest contact list'; end if;
  begin
    perform * from public.claim_invitation_email(current_setting('birthday.link_invite')::uuid);
    raise exception 'FAIL: guest email sender';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('birthday.link_guest_b'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.join_invitation(current_setting('birthday.link_token'));
do $$ begin
  if (select children from public.get_my_rsvp()) <> 1 then raise exception 'FAIL: second device cannot read family RSVP'; end if;
end $$;
select public.save_my_rsvp('Familia prueba enlace', true, 2, 3, 'Actualizada desde segundo dispositivo');
do $$ begin
  if (select count(*) from public.get_my_rsvp()) <> 1 then raise exception 'FAIL: duplicated family RSVP'; end if;
  if (select children from public.get_my_rsvp()) <> 3 then raise exception 'FAIL: second device update'; end if;
  begin
    perform public.join_invitation(current_setting('birthday.other_token'));
    raise exception 'FAIL: identity rebound to other invitation';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('birthday.link_guest_other'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.join_invitation(current_setting('birthday.other_token'));
do $$ begin
  if exists(select 1 from public.rsvps where invitation_id = current_setting('birthday.link_invite')::uuid) then raise exception 'FAIL: unrelated family RSVP visible'; end if;
end $$;
reset role;
update public.invitations set active = false where id = current_setting('birthday.link_invite')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('birthday.link_guest_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if public.is_guest() then raise exception 'FAIL: revoked invitation still authorizes'; end if;
  if exists(select 1 from public.resolve_invitation(current_setting('birthday.link_token'))) then raise exception 'FAIL: revoked link resolution'; end if;
  if exists(select 1 from public.event_details) then raise exception 'FAIL: revoked guest address'; end if;
end $$;
reset role;
rollback;
select 'PASS: personal links, protected contacts, multi-device RSVP, unrelated family isolation, email authorization and link revocation' as result;
