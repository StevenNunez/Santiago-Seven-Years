create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 20 and 2048 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-zA-Z0-9.-]+\.push\.apple\.com)/'),
  p256dh text not null check (length(p256dh) between 80 and 100),
  auth text not null check (length(auth) between 20 and 30),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy push_read on public.push_subscriptions for select to authenticated using (user_id=auth.uid());
create policy push_add on public.push_subscriptions for insert to authenticated with check (user_id=auth.uid() and public.is_guest());
create policy push_update on public.push_subscriptions for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_guest());
create policy push_remove on public.push_subscriptions for delete to authenticated using (user_id=auth.uid());

create table public.push_deliveries (
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  reminder_key text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempted_at timestamptz not null default now(),
  primary key (subscription_id,reminder_key)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon, authenticated;

create function public.claim_push_batch(reminder text, target uuid default null)
returns setof public.push_subscriptions language sql security definer set search_path=public as $$
  with eligible as (
    select s.* from push_subscriptions s
    join profiles p on p.user_id=s.user_id
    left join invitations i on i.id=p.invitation_id
    where (target is null or s.id=target)
      and (p.role='admin' or i.active=true)
      and (target is not null or not exists(select 1 from rsvps r where r.invitation_id=i.id and r.attending=false))
  ), claimed as (
    insert into push_deliveries(subscription_id,reminder_key)
    select id,reminder from eligible
    on conflict (subscription_id,reminder_key) do update set status='pending',attempted_at=now()
      where push_deliveries.status='failed' or (push_deliveries.status='pending' and push_deliveries.attempted_at < now()-interval '10 minutes')
    returning subscription_id
  ) select e.* from eligible e join claimed c on c.subscription_id=e.id;
$$;
revoke all on function public.claim_push_batch(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_push_batch(text,uuid) to service_role;
