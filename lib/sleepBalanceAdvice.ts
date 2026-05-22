import type { SleepLogRow } from "@/lib/fetchSleepLogChartData";
import { labelForSoundId } from "@/lib/soundLabels";
import { getSoundWellness } from "@/lib/soundWellness";

export type TrendKind = "improving" | "declining" | "stable" | "unknown";

export type FrequencyStatRow = {
  soundId: string;
  label: string;
  playCount: number;
  avgScore: number;
  mind: number;
  body: number;
  theme: string;
  /** 履歴内での相対パフォーマンス 0–100 */
  performance: number;
};

export type SleepBalanceAdvice = {
  trend: TrendKind;
  trendLabel: string;
  trendDetail: string;
  mindIndex: number;
  bodyIndex: number;
  balanceLabel: string;
  frequencyTable: FrequencyStatRow[];
  chartBars: { label: string; avgScore: number; playCount: number }[];
  insights: string[];
  recommendation: {
    soundId: string;
    label: string;
    reason: string;
    tip: string;
  } | null;
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function analyzeTrend(rows: SleepLogRow[]): {
  trend: TrendKind;
  trendLabel: string;
  trendDetail: string;
} {
  if (rows.length < 2) {
    return {
      trend: "unknown",
      trendLabel: "データ収集中",
      trendDetail:
        "あと数回セッションを記録すると、スッキリ度の傾向が見えてきます。",
    };
  }

  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const mid = Math.ceil(sorted.length / 2);
  const earlier = sorted.slice(0, mid).map((r) => r.wake_score);
  const recent = sorted.slice(mid).map((r) => r.wake_score);
  const earlierAvg = avg(earlier);
  const recentAvg = avg(recent);

  if (earlierAvg == null || recentAvg == null) {
    return {
      trend: "unknown",
      trendLabel: "データ収集中",
      trendDetail: "記録が増えると傾向を分析できます。",
    };
  }

  const diff = recentAvg - earlierAvg;
  if (diff >= 0.35) {
    return {
      trend: "improving",
      trendLabel: "スッキリ度 ↑ 上向き",
      trendDetail: `直近の平均（${recentAvg.toFixed(1)}）が前半（${earlierAvg.toFixed(1)}）より高めです。今の聴き方が合っている可能性があります。`,
    };
  }
  if (diff <= -0.35) {
    return {
      trend: "declining",
      trendLabel: "スッキリ度 ↓ 要注意",
      trendDetail: `直近の平均（${recentAvg.toFixed(1)}）が前半（${earlierAvg.toFixed(1)}）より低めです。周波数の見直しを検討してみてください。`,
    };
  }
  return {
    trend: "stable",
    trendLabel: "スッキリ度 → 安定",
    trendDetail: `平均はおおむね ${recentAvg.toFixed(1)} 前後で推移しています。バランスの取れた音を継続するのがおすすめです。`,
  };
}

function buildFrequencyStats(rows: SleepLogRow[]): FrequencyStatRow[] {
  const bySound = new Map<string, { scores: number[]; count: number }>();
  for (const r of rows) {
    const cur = bySound.get(r.sound_id) ?? { scores: [], count: 0 };
    cur.scores.push(r.wake_score);
    cur.count += 1;
    bySound.set(r.sound_id, cur);
  }

  const stats: FrequencyStatRow[] = [];
  for (const [soundId, { scores, count }] of bySound) {
    const a = avg(scores) ?? 3;
    const w = getSoundWellness(soundId);
    stats.push({
      soundId,
      label: labelForSoundId(soundId),
      playCount: count,
      avgScore: Math.round(a * 10) / 10,
      mind: w.mind,
      body: w.body,
      theme: w.theme,
      performance: 0,
    });
  }

  const maxScore = Math.max(...stats.map((s) => s.avgScore), 1);
  for (const s of stats) {
    s.performance = Math.round((s.avgScore / maxScore) * 100);
  }

  return stats.sort((a, b) => b.avgScore - a.avgScore || b.playCount - a.playCount);
}

function computeMindBodyIndex(
  rows: SleepLogRow[],
  stats: FrequencyStatRow[],
): { mindIndex: number; bodyIndex: number; balanceLabel: string } {
  if (stats.length === 0) {
    return {
      mindIndex: 50,
      bodyIndex: 50,
      balanceLabel: "記録なし",
    };
  }

  let mindSum = 0;
  let bodySum = 0;
  let weightSum = 0;

  for (const s of stats) {
    const w = s.playCount * Math.max(s.avgScore, 1);
    mindSum += s.mind * w;
    bodySum += s.body * w;
    weightSum += w;
  }

  const mindIndex = Math.round(mindSum / weightSum);
  const bodyIndex = Math.round(bodySum / weightSum);
  const diff = mindIndex - bodyIndex;

  let balanceLabel: string;
  if (Math.abs(diff) <= 8) {
    balanceLabel = "心と体がよく調和";
  } else if (diff > 8) {
    balanceLabel = "心（意識）寄り — 体の休息も意識";
  } else {
    balanceLabel = "体（休息）寄り — 心のケアも意識";
  }

  return { mindIndex, bodyIndex, balanceLabel };
}

function pickRecommendation(
  rows: SleepLogRow[],
  stats: FrequencyStatRow[],
  mindIndex: number,
  bodyIndex: number,
): SleepBalanceAdvice["recommendation"] {
  const SOLFEGGIO_PRIORITY = ["s3", "s2", "s1", "s4", "n7", "n4", "s5", "s6"];

  if (stats.length > 0 && stats[0].avgScore >= 3.8 && stats[0].playCount >= 1) {
    const best = stats[0];
    const w = getSoundWellness(best.soundId);
    return {
      soundId: best.soundId,
      label: best.label,
      reason: `履歴では ${best.label} のときのスッキリ度がいちばん高い（平均 ${best.avgScore}）です。`,
      tip: w.balanceTip,
    };
  }

  const diff = mindIndex - bodyIndex;
  let targetId: string;
  if (diff > 10) {
    targetId = "n3";
  } else if (diff < -10) {
    targetId = "s4";
  } else {
    targetId = "s3";
  }

  const tried = new Set(rows.map((r) => r.sound_id));
  const alt =
    SOLFEGGIO_PRIORITY.find((id) => !tried.has(id)) ?? targetId;
  const pick = tried.has(targetId) ? targetId : alt;
  const w = getSoundWellness(pick);

  let reason: string;
  if (diff > 10) {
    reason =
      "心の指標が体より高めです。深い休息を優先できる音で、体側のバランスを取り戻しましょう。";
  } else if (diff < -10) {
    reason =
      "体の休息寄りの聴き方です。心のつながり・安心感を高める音で、意識のバランスを整えましょう。";
  } else {
    reason =
      "心身のバランスを整える基調音として、修復・調和の周波数がおすすめです。";
  }

  return {
    soundId: pick,
    label: labelForSoundId(pick),
    reason,
    tip: w.balanceTip,
  };
}

function buildInsights(
  trend: TrendKind,
  stats: FrequencyStatRow[],
  mindIndex: number,
  bodyIndex: number,
): string[] {
  const out: string[] = [];

  if (stats.length >= 2) {
    const top = stats[0];
    const weak = stats[stats.length - 1];
    if (top.soundId !== weak.soundId) {
      out.push(
        `${top.label} は平均 ${top.avgScore} と良好。${weak.label} は ${weak.avgScore} と低めで、聴く時間帯やタイマー長の見直し余地があります。`,
      );
    }
  }

  if (stats.length === 1) {
    out.push(
      `現在は ${stats[0].label} が中心です。別の周波数も試すと、心と体のどちらが反応しやすいか比較できます。`,
    );
  }

  const solfeggioCount = stats.filter((s) => s.soundId.startsWith("s")).length;
  const sleepCount = stats.filter((s) => !s.soundId.startsWith("s")).length;
  if (solfeggioCount > 0 && sleepCount === 0) {
    out.push(
      "ソルフェジオ中心の聴き方です。深い休息が必要な夜はノイズ・デルタ波も組み合わせると体の側が整いやすくなります。",
    );
  } else if (sleepCount > 0 && solfeggioCount === 0) {
    out.push(
      "睡眠ノイズ中心です。心のケアには 396〜528Hz のソルフェジオを足すと、意識のバランスが取りやすくなります。",
    );
  }

  if (Math.abs(mindIndex - bodyIndex) > 12) {
    out.push(
      `心 ${mindIndex} / 体 ${bodyIndex} の指数差があり、おすすめ音で不足している側を補うとよいでしょう。`,
    );
  }

  if (trend === "declining") {
    out.push(
      "直近でスッキリ度が下がり気味です。いつもと違う周波数を1週間試す A/B テストが有効です。",
    );
  }

  if (out.length === 0) {
    out.push(
      "記録を重ねるほど、あなたに合う周波数の傾向がはっきりします。",
    );
  }

  return out.slice(0, 4);
}

export function buildSleepBalanceAdvice(
  rows: SleepLogRow[],
): SleepBalanceAdvice | null {
  if (rows.length === 0) return null;

  const { trend, trendLabel, trendDetail } = analyzeTrend(rows);
  const frequencyTable = buildFrequencyStats(rows);
  const { mindIndex, bodyIndex, balanceLabel } = computeMindBodyIndex(
    rows,
    frequencyTable,
  );
  const chartBars = frequencyTable.map((s) => ({
    label: s.label,
    avgScore: s.avgScore,
    playCount: s.playCount,
  }));
  const insights = buildInsights(trend, frequencyTable, mindIndex, bodyIndex);
  const recommendation = pickRecommendation(
    rows,
    frequencyTable,
    mindIndex,
    bodyIndex,
  );

  return {
    trend,
    trendLabel,
    trendDetail,
    mindIndex,
    bodyIndex,
    balanceLabel,
    frequencyTable,
    chartBars,
    insights,
    recommendation,
  };
}
