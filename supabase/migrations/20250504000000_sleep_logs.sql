-- sleep_logs: 528Hz などを「再生し始めた瞬間」をユーザー単位で記録する
create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  played_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.sleep_logs is 'サウンド再生開始時刻のログ';

create index sleep_logs_user_id_played_at_idx
  on public.sleep_logs (user_id, played_at desc);

alter table public.sleep_logs enable row level security;

create policy "sleep_logs_select_own"
  on public.sleep_logs
  for select
  using (auth.uid() = user_id);

create policy "sleep_logs_insert_own"
  on public.sleep_logs
  for insert
  with check (auth.uid() = user_id);
