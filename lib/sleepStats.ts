import { labelForSoundId } from "@/lib/soundLabels";

import {
  formatSleepLogsForChart,
  type SleepLogChartPoint,
  type SleepLogRow,
} from "@/lib/fetchSleepLogChartData";

/** @deprecated SleepLogRow を使用 */
export type SleepLogStatRow = SleepLogRow;

export type DailyWakeScore = {
  dateKey: string;
  label: string;
  wake_score: number | null;
};

export type SleepStatsSummary = {
  weekTotalDurationSec: number;
  topSoundId: string | null;
  topSoundLabel: string;
  avgWakeScore: number | null;
};

export type SleepStatsBundle = {
  dailyChart: DailyWakeScore[];
  summary: SleepStatsSummary;
};

const MS_PER_DAY = 86_400_000;

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 月曜始まりの今週0時 */
export function startOfWeekMonday(d: Date): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function formatDayLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 過去7日（今日含む）の日別平均 wake_score */
export function buildDailyWakeScores(
  rows: SleepLogStatRow[],
  now = new Date(),
): DailyWakeScore[] {
  const today = startOfLocalDay(now);
  const days: DailyWakeScore[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * MS_PER_DAY);
    const key = dateKeyLocal(d);
    const dayRows = rows.filter((r) => {
      const created = startOfLocalDay(new Date(r.created_at));
      return dateKeyLocal(created) === key;
    });
    const scores = dayRows.map((r) => r.wake_score).filter(Number.isFinite);
    const wake_score =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;
    days.push({
      dateKey: key,
      label: formatDayLabel(d),
      wake_score,
    });
  }

  return days;
}

function modeSoundId(rows: SleepLogStatRow[]): string | null {
  if (rows.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.sound_id, (counts.get(r.sound_id) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

export function buildSleepStats(
  rows: SleepLogStatRow[],
  now = new Date(),
): SleepStatsBundle {
  const weekStart = startOfWeekMonday(now);
  const weekRows = rows.filter(
    (r) => new Date(r.created_at) >= weekStart,
  );

  const weekTotalDurationSec = weekRows.reduce(
    (sum, r) => sum + (r.duration_sec ?? 0),
    0,
  );

  const topSoundId = modeSoundId(weekRows);
  const wakeScores = weekRows
    .map((r) => r.wake_score)
    .filter((s) => Number.isFinite(s));
  const avgWakeScore =
    wakeScores.length > 0
      ? wakeScores.reduce((a, b) => a + b, 0) / wakeScores.length
      : null;

  return {
    dailyChart: buildDailyWakeScores(rows, now),
    summary: {
      weekTotalDurationSec,
      topSoundId,
      topSoundLabel: topSoundId
        ? labelForSoundId(topSoundId)
        : "—",
      avgWakeScore,
    },
  };
}

export function formatDurationJa(totalSec: number): string {
  if (totalSec <= 0) return "0分";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分`;
  return `${totalSec}秒`;
}

export function formatWakeScoreAvg(avg: number | null): string {
  if (avg == null || !Number.isFinite(avg)) return "—";
  return avg.toFixed(1);
}

function buildPreviewRows(now = new Date()): SleepLogRow[] {
  const today = startOfLocalDay(now);
  const fakeRows: SleepLogRow[] = [];
  const sounds = ["s3", "s2", "s3", "s1", "s3", "s2", "s3"] as const;
  const scores = [4, 3.5, 5, 4, 3, 4.5, 4] as const;

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * MS_PER_DAY);
    d.setHours(21, 0, 0, 0);
    fakeRows.push({
      duration_sec: 2400 + i * 300,
      sound_id: sounds[6 - i] ?? "s3",
      wake_score: Math.round(scores[6 - i] ?? 4),
      created_at: d.toISOString(),
    });
  }

  return fakeRows;
}

/** 未ログイン用のプレビューデータ */
export function previewSleepStats(now = new Date()): SleepStatsBundle {
  return buildSleepStats(buildPreviewRows(now), now);
}

/** 未ログイン用のグラフプレビュー（recharts 形式） */
export function previewSleepLogChartData(
  now = new Date(),
): SleepLogChartPoint[] {
  return formatSleepLogsForChart(buildPreviewRows(now), now);
}
