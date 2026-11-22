-- Create an initial admin user (replace email + hash before running).
-- Generate hash example (node):
--   node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 12))"
insert into admin_user (email, password_hash, full_name, is_active)
values ('admin@medico.com', '$2b$12$IuyYoMcRn4y.NnQGvnZktekkiqS8cEuE66hDkfS4A2Y9rzd.YM8fO', 'Admin', true)
on conflict (email) do update
set password_hash = excluded.password_hash,
    full_name = excluded.full_name,
    is_active = excluded.is_active;

