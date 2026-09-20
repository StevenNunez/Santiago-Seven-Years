begin;
select set_config('birthday.push_user',gen_random_uuid()::text,true);
select set_config('birthday.push_other',gen_random_uuid()::text,true);
select set_config('birthday.push_invite',gen_random_uuid()::text,true);
select set_config('birthday.push_sub',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('birthday.push_user')::uuid),(current_setting('birthday.push_other')::uuid);
insert into public.invitations(id,recipient_name) values(current_setting('birthday.push_invite')::uuid,'Familia demo push');
insert into public.profiles(user_id,display_name,invitation_id) values(current_setting('birthday.push_user')::uuid,'Familia demo push',current_setting('birthday.push_invite')::uuid);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('birthday.push_user'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.push_subscriptions(id,user_id,endpoint,p256dh,auth) values(current_setting('birthday.push_sub')::uuid,auth.uid(),'https://fcm.googleapis.com/fixture/'||current_setting('birthday.push_sub'),repeat('A',87),repeat('B',22));
do $$ begin
  if (select count(*) from public.push_subscriptions)<>1 then raise exception 'FAIL own subscription'; end if;
  if has_function_privilege('authenticated','public.claim_push_batch(text,uuid)','execute') then raise exception 'FAIL guest can dispatch'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('birthday.push_other'),'role','authenticated')::text,true);
do $$ begin if exists(select 1 from public.push_subscriptions) then raise exception 'FAIL cross-user exposure'; end if; end $$;
reset role;
do $$ begin
  if (select count(*) from public.claim_push_batch('fixture',current_setting('birthday.push_sub')::uuid))<>1 then raise exception 'FAIL initial claim'; end if;
  if exists(select 1 from public.claim_push_batch('fixture',current_setting('birthday.push_sub')::uuid)) then raise exception 'FAIL duplicated dispatch'; end if;
end $$;
update public.push_deliveries set status='sent' where subscription_id=current_setting('birthday.push_sub')::uuid;
do $$ begin if exists(select 1 from public.claim_push_batch('fixture',current_setting('birthday.push_sub')::uuid)) then raise exception 'FAIL repeat sent'; end if; end $$;
update public.invitations set active=false where id=current_setting('birthday.push_invite')::uuid;
do $$ begin if exists(select 1 from public.claim_push_batch('fixture-revoked',current_setting('birthday.push_sub')::uuid)) then raise exception 'FAIL revoked recipient'; end if; end $$;
rollback;
select 'PASS: own subscriptions, private endpoints, service-only dispatch, deduplication, revocation; rolled back' as result;
