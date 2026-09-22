-- The organizer curates which RSVP notes appear in the "Niveles anteriores" closing chapter.
alter table public.rsvps add column wish_on_show boolean not null default true;
create policy "Organizer curates wishes" on public.rsvps for update to authenticated using (public.is_admin()) with check (public.is_admin());
