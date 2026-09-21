begin;
do $$
declare a uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); other_guest uuid:=gen_random_uuid();
  inv uuid:=gen_random_uuid(); other_inv uuid:=gen_random_uuid(); photo uuid:=gen_random_uuid(); other_photo uuid:=gen_random_uuid();
  token text:=encode(extensions.gen_random_bytes(32),'hex');
begin
  insert into auth.users(id) values(a),(g),(other_guest);
  insert into public.invitations(id,recipient_name,token) values(inv,'Familia demo eliminación',token);
  insert into public.invitations(id,recipient_name) values(other_inv,'Familia demo conservada');
  insert into public.profiles(user_id,display_name,role,invitation_id) values(a,'Organizador demo','admin',null),(g,'Invitado demo','guest',inv),(other_guest,'Otro invitado demo','guest',other_inv);
  insert into public.rsvps(user_id,invitation_id,family_name,attending,adults,children) values(g,inv,'Familia demo',true,2,1),(other_guest,other_inv,'Otra familia',true,1,0);
  insert into public.photos(id,user_id,storage_path) values(photo,g,g||'/demo.jpg'),(other_photo,other_guest,other_guest||'/demo.jpg');
  insert into public.comments(photo_id,user_id,body) values(photo,other_guest,'Comentario en foto eliminada'),(other_photo,g,'Comentario del invitado eliminado'),(other_photo,other_guest,'Conservar');
  insert into public.likes(photo_id,user_id) values(photo,other_guest),(other_photo,g),(other_photo,other_guest);
  perform set_config('request.jwt.claims',json_build_object('sub',g,'role','authenticated')::text,true);
  begin
    perform public.delete_birthday_invitation(inv);
    raise exception 'FAIL guest deleted invitation';
  exception when others then
    if sqlerrm='FAIL guest deleted invitation' then raise; end if;
  end;
  if not exists(select 1 from public.invitations where id=inv) then raise exception 'FAIL unauthorized mutation';end if;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  insert into public.wallet_passes(invitation_id) values(inv);
  begin
    perform public.delete_birthday_invitation(inv);
    raise exception 'FAIL pending wallet deletion';
  exception when others then
    if sqlerrm='FAIL pending wallet deletion' then raise; end if;
  end;
  update public.wallet_passes set status='ready',serial_number='demo-serial',share_url='https://api.walletwallet.dev/p/demo' where invitation_id=inv;
  perform public.delete_birthday_invitation(inv);
  perform public.delete_birthday_invitation(inv);
  if exists(select 1 from public.invitations where id=inv) or exists(select 1 from public.profiles where user_id=g) or exists(select 1 from public.rsvps where invitation_id=inv) or exists(select 1 from public.photos where id=photo) then raise exception 'FAIL incomplete deletion';end if;
  if exists(select 1 from public.comments where user_id=g or photo_id=photo) or exists(select 1 from public.likes where user_id=g or photo_id=photo) then raise exception 'FAIL comments/likes remain';end if;
  if not exists(select 1 from public.invitations where id=other_inv) or not exists(select 1 from public.photos where id=other_photo) or not exists(select 1 from public.comments where photo_id=other_photo and user_id=other_guest) or not exists(select 1 from public.rsvps where invitation_id=other_inv) then raise exception 'FAIL unrelated content changed';end if;
  if not exists(select 1 from public.invitation_cleanup where invitation_id=inv and storage_paths=array[g||'/demo.jpg',g||'/demo.thumb.jpg'] and wallet_serial='demo-serial') then raise exception 'FAIL cleanup queue';end if;
  if exists(select 1 from public.resolve_invitation_entry(token)) then raise exception 'FAIL deleted link';end if;
  perform set_config('request.jwt.claims',json_build_object('sub',g,'role','authenticated')::text,true);
  if public.is_guest() then raise exception 'FAIL legacy access granted';end if;
  if has_table_privilege('authenticated','public.invitation_cleanup','select') or has_function_privilege('anon','public.delete_birthday_invitation(uuid)','execute') then raise exception 'FAIL private privileges';end if;
end $$;
select 'PASS: admin-only deletion, cascade, other invitation isolation, pending-wallet guard, cleanup queue, removed-link and guest access' as result;
rollback;
