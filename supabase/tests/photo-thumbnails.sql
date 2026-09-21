begin;
do $$
declare def text;
begin
  select pg_get_expr(polwithcheck,polrelid) into def from pg_policy where polname='Upload private photo';
  if position('(\.thumb)?\.jpg$' in def)=0 then raise exception 'FAIL thumbnail path not allowed by upload policy'; end if;
  if not ('11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.thumb.jpg' ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(\.thumb)?\.jpg$') then raise exception 'FAIL thumb regex'; end if;
  if ('11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.other.jpg' ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(\.thumb)?\.jpg$') then raise exception 'FAIL regex too permissive'; end if;
  raise notice 'PASS photo thumbnails policy';
end $$;
rollback;
