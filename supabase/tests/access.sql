-- Real Postgres RLS checks. Every fixture and configuration change is rolled back.
begin;
select set_config('birthday.test_guest_a', gen_random_uuid()::text, true);
select set_config('birthday.test_guest_b', gen_random_uuid()::text, true);
insert into auth.users (id) values
  (current_setting('birthday.test_guest_a')::uuid),
  (current_setting('birthday.test_guest_b')::uuid);
insert into birthday_private.invitation(id, code_hash)
values (true, extensions.crypt('temporary-verification-code', extensions.gen_salt('bf')))
on conflict (id) do update set code_hash = excluded.code_hash;

set local role anon;
do $$ begin
  if (select count(*) from public.event_settings) <> 1 then raise exception 'FAIL: public schedule'; end if;
  begin
    perform * from public.event_details;
    raise exception 'FAIL: public address exposed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('birthday.test_guest_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if public.is_guest() then raise exception 'FAIL: uninvited membership'; end if;
  if exists(select 1 from public.event_details) then raise exception 'FAIL: uninvited address exposed'; end if;
  if public.join_party('wrong-code', 'Prueba A') then raise exception 'FAIL: invalid code accepted'; end if;
end $$;
reset role;
-- Remove the failed attempt only in the test transaction to avoid waiting.
delete from birthday_private.join_attempts where user_id = current_setting('birthday.test_guest_a')::uuid;
set local role authenticated;
do $$ begin
  if not public.join_party('temporary-verification-code', 'Prueba A') then raise exception 'FAIL: valid invitation rejected'; end if;
  if not public.is_guest() or public.is_admin() then raise exception 'FAIL: guest role'; end if;
  if (select count(*) from public.event_details) <> 1 then raise exception 'FAIL: invited address unavailable'; end if;
  begin
    update public.profiles set role = 'admin' where user_id = auth.uid();
    raise exception 'FAIL: privilege escalation';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_invitation_code('changed-by-guest');
    raise exception 'FAIL: guest changed invitation code';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
insert into public.rsvps(user_id, family_name, attending, adults, children)
values (auth.uid(), 'Familia de prueba A', true, 2, 1);
update public.rsvps set children = 2 where user_id = auth.uid();
do $$ begin
  if (select children from public.rsvps where user_id = auth.uid()) <> 2 then raise exception 'FAIL: own RSVP update'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('birthday.test_guest_b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if not public.join_party('temporary-verification-code', 'Prueba B') then raise exception 'FAIL: second guest'; end if;
  if exists(select 1 from public.rsvps) then raise exception 'FAIL: other family RSVP exposed'; end if;
  begin
    insert into public.rsvps(user_id, family_name, attending, adults, children)
    values (current_setting('birthday.test_guest_a')::uuid, 'Spoofed family', true, 1, 0);
    raise exception 'FAIL: forged RSVP owner';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

update public.event_settings set uploads_open_at = now() - interval '1 hour', uploads_close_at = now() + interval '1 hour', uploads_enabled = true;
set local role authenticated;
do $$ begin
  if not public.uploads_are_open() then raise exception 'FAIL: open upload window'; end if;
end $$;
reset role;
update public.event_settings set uploads_enabled = false;
set local role authenticated;
do $$ begin
  if public.uploads_are_open() then raise exception 'FAIL: paused uploads'; end if;
end $$;
reset role;
update public.event_settings set uploads_enabled = true, uploads_open_at = now() - interval '2 hours', uploads_close_at = now() - interval '1 hour';
set local role authenticated;
do $$ begin
  if public.uploads_are_open() then raise exception 'FAIL: expired uploads'; end if;
end $$;
reset role;

do $$ begin
  if (select public from storage.buckets where id = 'memories') then raise exception 'FAIL: public photo bucket'; end if;
  if (select allowed_mime_types from storage.buckets where id = 'memories') <> array['image/jpeg'] then raise exception 'FAIL: bucket file restriction'; end if;
end $$;
rollback;
select 'PASS: guest access, invalid codes, private address, RSVP isolation, role protection, upload windows and private image bucket' as result;
