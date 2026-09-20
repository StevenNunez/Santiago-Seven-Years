-- Server-only cache. The primary key also prevents concurrent duplicate issuance.
create table public.wallet_passes (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  serial_number text,
  share_url text,
  created_at timestamptz not null default now(),
  check (status <> 'ready' or (serial_number is not null and share_url is not null))
);
alter table public.wallet_passes enable row level security;
revoke all on public.wallet_passes from public, anon, authenticated;
grant select, insert, update, delete on public.wallet_passes to service_role;
