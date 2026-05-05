-- notes を jsonb で運用（既存が text の場合は退避オブジェクトに変換）
do $$
declare
  col_type text;
begin
  select c.data_type into col_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'sleep_logs'
    and c.column_name = 'notes';

  if col_type is null then
    alter table public.sleep_logs add column notes jsonb;
  elsif col_type in ('text', 'character varying') then
    alter table public.sleep_logs
      alter column notes type jsonb using (
        case
          when notes is null then null::jsonb
          else jsonb_build_object(
            'label', notes::text,
            'minutes', null,
            'frequency_hz', null,
            '_legacy', true
          )
        end
      );
  end if;
end $$;

comment on column public.sleep_logs.notes is
  'JSON: label（音源）, minutes（オフタイマー分）, frequency_hz（単一周波数、ノイズは null）';
