begin;
do $$
declare a uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); inv uuid:=gen_random_uuid(); other uuid:=gen_random_uuid();
begin
  insert into auth.users(id) values(a),(g),(o);
  insert into public.invitations(id,recipient_name) values(inv,'Familia demo'),(other,'Otra familia');
  insert into public.profiles(user_id,display_name,role,invitation_id) values(a,'Organizador','admin',null),(g,'Invitado','guest',inv),(o,'Otro','guest',other);
  insert into public.rsvps(user_id,invitation_id,family_name,attending,adults,children,note) values(g,inv,'Familia demo',true,2,1,'Llegaré tarde'),(o,other,'Otra familia',true,1,0,'¡Feliz cumple!');
  if not (select wish_on_show from public.rsvps where user_id=g) then raise exception 'FAIL default should show'; end if;
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',g,'role','authenticated')::text,true);
  update public.rsvps set wish_on_show=false where user_id=o;
  if not (select wish_on_show from public.rsvps where user_id=o) then raise exception 'FAIL guest changed another family'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  update public.rsvps set wish_on_show=false where invitation_id=inv;
  if (select wish_on_show from public.rsvps where user_id=g) then raise exception 'FAIL organizer cannot curate'; end if;
end $$;
select 'PASS: wish_on_show defaults on, organizer curates, guests cannot touch others' as result;
rollback;
