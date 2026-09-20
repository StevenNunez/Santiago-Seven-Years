-- 1. Create the organizer in Supabase Authentication > Users > Add user.
--    Choose the email and password privately; do not put them in the repo.
-- 2. Replace the UUID below with that user's ID, then run this SQL.
insert into public.profiles (user_id, display_name, role)
values ('REPLACE_WITH_AUTH_USER_UUID', 'Organización', 'admin')
on conflict (user_id) do update set role = 'admin';
-- 3. Log in at /#organizar, then set the invitation code (at least 10 characters).
--    No invitation code is hardcoded or seeded in the public site.
