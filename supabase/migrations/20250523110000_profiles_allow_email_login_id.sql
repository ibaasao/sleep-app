-- メールアドレスをログインIDとして使えるように制約を緩和
alter table public.profiles drop constraint if exists profiles_login_id_format;
alter table public.profiles drop constraint if exists profiles_login_id_len;

alter table public.profiles add constraint profiles_login_id_len
  check (char_length(login_id) >= 3 and char_length(login_id) <= 254);

alter table public.profiles add constraint profiles_login_id_format
  check (login_id ~ '^[a-z0-9_@.+-]+$');
