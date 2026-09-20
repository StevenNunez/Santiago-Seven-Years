begin;
select set_config('birthday.code_user',gen_random_uuid()::text,true);
select set_config('birthday.code_invite',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('birthday.code_user')::uuid);
insert into public.invitations(id,recipient_name) values(current_setting('birthday.code_invite')::uuid,'Familia demo códigos');
select set_config('birthday.code_new',access_code,true),set_config('birthday.code_token',token,true) from public.invitations where id=current_setting('birthday.code_invite')::uuid;
insert into birthday_private.legacy_invitation_codes values(current_setting('birthday.code_invite')::uuid,'0123456789ABCDEFABCD');
do $$ begin
  if current_setting('birthday.code_new') !~ '^Santiago-[A-Za-z]+-[A-HJ-NP-Z2-9]{8}$' then raise exception 'FAIL format'; end if;
  if (select count(distinct public.generate_themed_guest_code()) from generate_series(1,500))<>500 then raise exception 'FAIL uniqueness'; end if;
  if has_table_privilege('authenticated','birthday_private.legacy_invitation_codes','select') then raise exception 'FAIL legacy privacy'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('birthday.code_user'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  if public.resolve_guest_code(lower(replace(current_setting('birthday.code_new'),'-',' '))) is distinct from current_setting('birthday.code_token') then raise exception 'FAIL normalized resolution'; end if;
  if public.resolve_guest_code(current_setting('birthday.code_new')) is not null then raise exception 'FAIL cooldown'; end if;
end $$;
select public.join_invitation(current_setting('birthday.code_token'));
do $$ begin
  if not public.unlock_personal_album(lower(current_setting('birthday.code_new'))) then raise exception 'FAIL themed unlock'; end if;
  if not public.unlock_personal_album('0123-4567-89ab-cdef-abcd') then raise exception 'FAIL legacy unlock'; end if;
  if public.unlock_personal_album('Santiago-Rex-WRONG') then raise exception 'FAIL wrong code'; end if;
end $$;
reset role;
delete from birthday_private.join_attempts where user_id=current_setting('birthday.code_user')::uuid;
set local role authenticated;
do $$ begin if public.resolve_guest_code('0123-4567-89ab-cdef-abcd') is distinct from current_setting('birthday.code_token') then raise exception 'FAIL legacy resolution'; end if; end $$;
reset role;
update public.invitations set active=false where id=current_setting('birthday.code_invite')::uuid;
set local role authenticated;
do $$ begin if public.unlock_personal_album(current_setting('birthday.code_new')) or public.unlock_personal_album('0123456789ABCDEFABCD') then raise exception 'FAIL revoked access'; end if; end $$;
reset role;
rollback;
select 'PASS: themed generation, normalization, legacy compatibility, cooldown, privacy, album unlock and revocation (rolled back)' as result;
