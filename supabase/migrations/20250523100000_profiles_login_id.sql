-- ログインID（ユーザー名）と auth.users を紐づけ
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  login_id text not null,
  created_at timestamptz not null default now(),
  constraint profiles_login_id_len check (char_length(login_id) >= 3),
  constraint profiles_login_id_format check (login_id ~ '^[a-z0-9_]+$')
);

create unique index if not exists profiles_login_id_unique on public.profiles (login_id);

comment on table public.profiles is 'アプリ内ログインID（sleep_logs の user_id と連動）';

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id);

-- 新規 signUp 時に profiles を自動作成
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lid text;
begin
  lid := lower(trim(coalesce(new.raw_user_meta_data->>'login_id', '')));
  if lid = '' then
    lid := lower(split_part(new.email, '@', 1));
  end if;
  insert into public.profiles (id, login_id)
  values (new.id, lid)
  on conflict (id) do update set login_id = excluded.login_id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- 既存ユーザーのバックフィル（メール登録者は @ 前を仮 login_id に）
insert into public.profiles (id, login_id)
select
  u.id,
  lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_]', '_', 'g'))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
