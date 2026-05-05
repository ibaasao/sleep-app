alter table public.sleep_logs
  add column if not exists notes jsonb;

comment on column public.sleep_logs.notes is
  'JSON: label, minutes, frequency_hz（アプリがオブジェクトで保存）';
