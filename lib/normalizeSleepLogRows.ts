import type { SleepLogRow } from "@/lib/fetchSleepLogChartData";
import { soundIdFromLabel } from "@/lib/soundLabels";

const MS_PER_DAY = 86_400_000;

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sevenDaysAgoIso(now = new Date()): string {
  const d = startOfLocalDay(now);
  d.setDate(d.getDate() - 6);
  return d.toISOString();
}

type LegacyNotes = {
  label?: string;
  minutes?: number;
  frequency_hz?: number | null;
};

function rowTimestamp(raw: Record<string, unknown>): string | null {
  const played = raw.played_at;
  const created = raw.created_at;
  if (typeof played === "string") return played;
  if (typeof created === "string") return created;
  return null;
}

function isWithinLast7Days(iso: string, now = new Date()): boolean {
  return new Date(iso) >= new Date(sevenDaysAgoIso(now));
}

/**
 * 新スキーマ（duration_sec / sound_id / wake_score）と
 * 旧スキーマ（played_at / notes）の両方を SleepLogRow に統一。
 */
export function normalizeSleepLogRows(
  rawRows: Record<string, unknown>[] | null,
  now = new Date(),
): SleepLogRow[] {
  if (!rawRows?.length) return [];

  const out: SleepLogRow[] = [];

  for (const raw of rawRows) {
    const created_at = rowTimestamp(raw);
    if (!created_at || !isWithinLast7Days(created_at, now)) continue;

    const duration_sec = raw.duration_sec;
    const sound_id = raw.sound_id;
    const wake_score = raw.wake_score;

    if (
      typeof duration_sec === "number" &&
      typeof sound_id === "string" &&
      typeof wake_score === "number"
    ) {
      out.push({
        duration_sec,
        sound_id,
        wake_score,
        created_at,
      });
      continue;
    }

    const notes =
      raw.notes && typeof raw.notes === "object"
        ? (raw.notes as LegacyNotes)
        : null;
    const label =
      typeof notes?.label === "string" ? notes.label : "unknown";
    const minutes =
      typeof notes?.minutes === "number" && Number.isFinite(notes.minutes)
        ? notes.minutes
        : 0;

    out.push({
      duration_sec: Math.max(0, Math.round(minutes * 60)),
      sound_id: soundIdFromLabel(label),
      wake_score: 3,
      created_at,
    });
  }

  return out;
}
