-- sleep_logs: 睡眠セッション（再生時間・音源・目覚めスコア）
-- 既に public.sleep_logs がある場合は、下の「既存テーブル移行」ブロックを検討してください。

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  duration_sec integer not null check (duration_sec >= 0),
  sound_id text not null,
  wake_score integer not null check (wake_score between 1 and 5),
  created_at timestamptz not null default now()
);

comment on table public.sleep_logs is '睡眠ログ（再生時間・音源・目覚めスコア）';
comment on column public.sleep_logs.duration_sec is '再生時間（秒）';
comment on column public.sleep_logs.sound_id is '聴いた音源の識別子（例: s1, s2, n1）';
comment on column public.sleep_logs.wake_score is '目覚めスッキリ度（1〜5）';

create index if not exists sleep_logs_user_id_created_at_idx
  on public.sleep_logs (user_id, created_at desc);

alter table public.sleep_logs enable row level security;

-- 既存ポリシー名と重複する場合は drop してから実行
drop policy if exists "sleep_logs_select_own" on public.sleep_logs;
drop policy if exists "sleep_logs_insert_own" on public.sleep_logs;

create policy "sleep_logs_select_own"
  on public.sleep_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "sleep_logs_insert_own"
  on public.sleep_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 既存テーブル（played_at / notes）から移行する場合の例（必要時のみ）
-- ---------------------------------------------------------------------------
-- alter table public.sleep_logs
--   add column if not exists duration_sec integer,
--   add column if not exists sound_id text,
--   add column if not exists wake_score integer;
--
-- update public.sleep_logs
-- set
--   duration_sec = coalesce(duration_sec, 0),
--   sound_id = coalesce(sound_id, notes->>'label', 'unknown'),
--   wake_score = coalesce(wake_score, 3)
-- where duration_sec is null or sound_id is null or wake_score is null;
--
-- alter table public.sleep_logs
--   alter column duration_sec set not null,
--   alter column sound_id set not null,
--   alter column wake_score set not null,
--   add constraint sleep_logs_wake_score_check check (wake_score between 1 and 5);
