import { createClient } from "@/lib/supabase/client";
import { normalizeSleepLogRows } from "@/lib/normalizeSleepLogRows";
import type { SupabaseClient } from "@supabase/supabase-js";

/** sleep_logs から取得する行 */
export type SleepLogRow = {
  duration_sec: number;
  sound_id: string;
  wake_score: number;
  created_at: string;
};

/**
 * recharts 等にそのまま渡せる日別集計
 * @example [{ date: '5/20', score: 4, duration: 45 }]
 */
export type SleepLogChartPoint = {
  /** 表示用ラベル（例: 5/20） */
  date: string;
  /** ソート・キー用 YYYY-MM-DD */
  dateKey: string;
  /** 日別平均の目覚めスコア（1〜5）。記録なしは null */
  score: number | null;
  /** 日別合計再生時間（分） */
  duration: number;
  /** その日にログがあるか */
  hasData: boolean;
};

export type FetchSleepLogChartSuccess = {
  ok: true;
  chartData: SleepLogChartPoint[];
  rows: SleepLogRow[];
};

export type FetchSleepLogChartFailure = {
  ok: false;
  chartData: SleepLogChartPoint[];
  warning?: string;
  error?: string;
};

export type FetchSleepLogChartResult =
  | FetchSleepLogChartSuccess
  | FetchSleepLogChartFailure;

const MS_PER_DAY = 86_400_000;

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatChartDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 過去7日（今日含む）の 0:00（ローカル） */
export function sevenDaysAgoIso(now = new Date()): string {
  const d = startOfLocalDay(now);
  d.setDate(d.getDate() - 6);
  return d.toISOString();
}

/** 記録のない日も含め、常に7件の枠を返す */
export function emptyChartSeries(now = new Date()): SleepLogChartPoint[] {
  const today = startOfLocalDay(now);
  const points: SleepLogChartPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * MS_PER_DAY);
    points.push({
      date: formatChartDate(d),
      dateKey: dateKeyLocal(d),
      score: null,
      duration: 0,
      hasData: false,
    });
  }
  return points;
}

/**
 * created_at ごとに wake_score（平均）と duration_sec（合計→分）を集計。
 */
export function formatSleepLogsForChart(
  rows: SleepLogRow[],
  now = new Date(),
): SleepLogChartPoint[] {
  const today = startOfLocalDay(now);
  const points: SleepLogChartPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * MS_PER_DAY);
    const key = dateKeyLocal(d);
    const dayRows = rows.filter((r) => {
      const created = startOfLocalDay(new Date(r.created_at));
      return dateKeyLocal(created) === key;
    });

    const scores = dayRows
      .map((r) => r.wake_score)
      .filter((s) => Number.isFinite(s));
    const score =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
          10
        : null;

    const durationSec = dayRows.reduce(
      (sum, r) => sum + (Number.isFinite(r.duration_sec) ? r.duration_sec : 0),
      0,
    );
    const duration = Math.round(durationSec / 60);

    points.push({
      date: formatChartDate(d),
      dateKey: key,
      score,
      duration,
      hasData: dayRows.length > 0,
    });
  }

  return points;
}

/**
 * ログイン中ユーザーの過去7日間 sleep_logs を取得し、グラフ用配列に整形する。
 * RLS により auth ユーザー自身の行のみ返る想定。
 */
export async function fetchSleepLogChartData(
  supabase?: SupabaseClient,
): Promise<FetchSleepLogChartResult> {
  const client = supabase ?? createClient();
  const empty = emptyChartSeries();

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) {
    return { ok: false, chartData: empty, error: userError.message };
  }

  if (!user) {
    return {
      ok: false,
      chartData: empty,
      warning: "ログインしていないため、睡眠ログを取得できません。",
    };
  }

  const since = sevenDaysAgoIso();
  let data: Record<string, unknown>[] | null = null;

  const byCreated = await client
    .from("sleep_logs")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (!byCreated.error && byCreated.data?.length) {
    data = byCreated.data as Record<string, unknown>[];
  } else {
    const byPlayed = await client
      .from("sleep_logs")
      .select("*")
      .gte("played_at", since)
      .order("played_at", { ascending: true });

    if (!byPlayed.error && byPlayed.data?.length) {
      data = byPlayed.data as Record<string, unknown>[];
    } else if (!byCreated.error) {
      data = (byCreated.data ?? []) as Record<string, unknown>[];
    } else if (!byPlayed.error) {
      data = (byPlayed.data ?? []) as Record<string, unknown>[];
    } else {
      const fallback = await client
        .from("sleep_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (fallback.error) {
        return { ok: false, chartData: empty, error: fallback.error.message };
      }
      data = (fallback.data ?? []) as Record<string, unknown>[];
    }
  }

  const rows = normalizeSleepLogRows(data);
  const chartData = formatSleepLogsForChart(rows);

  return { ok: true, chartData, rows };
}
