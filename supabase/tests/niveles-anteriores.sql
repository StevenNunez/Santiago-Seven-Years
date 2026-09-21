begin;
do $$
declare a uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); inv uuid:=gen_random_uuid();
begin
  insert into auth.users(id) values(a),(g);
  insert into public.invitations(id,recipient_name) values(inv,'Familia demo niveles');
  insert into public.profiles(user_id,display_name,role,invitation_id) values(a,'Organizador demo','admin',null),(g,'Invitado demo','guest',inv);
  insert into public.moments(kind,position,storage_path,caption,duration_ms,source_hash) values('photo',1,'niveles/1-demo.webp','Nivel 1',0,'h1'),('music',1,'niveles/musica-1-demo.m4a','',180000,'h2');
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',g,'role','authenticated')::text,true);
  if exists(select 1 from public.moments) then raise exception 'FAIL guest can read moments'; end if;
  begin
    insert into public.moments(kind,position,storage_path,source_hash) values('photo',9,'niveles/x.webp','h');
    raise exception 'FAIL guest inserted moment';
  exception when others then
    if sqlerrm='FAIL guest inserted moment' then raise; end if;
  end;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  if (select count(*) from public.moments)<>2 then raise exception 'FAIL organizer cannot read moments'; end if;
  perform set_config('role','postgres',true);
  if not exists(select 1 from storage.buckets where id='moments' and public=false and file_size_limit=52428800) then raise exception 'FAIL private moments bucket'; end if;
  if not exists(select 1 from pg_policy where polname='Organizer reads moments') then raise exception 'FAIL storage policy'; end if;
end $$;
select 'PASS: moments readable only by organizer, no guest writes, private bucket' as result;
rollback;
