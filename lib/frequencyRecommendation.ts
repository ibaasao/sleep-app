import type { SleepLogRow } from "@/lib/fetchSleepLogChartData";
import { labelForSoundId } from "@/lib/soundLabels";
import { getSoundWellness } from "@/lib/soundWellness";

export type HeartScanMetrics = {
  bpm: number;
  fluctuationMs: number;
  amplitude: number;
  reliable: boolean;
};

export type SolfeggioSoundId = "s1" | "s2" | "s3" | "s4";
export type SolfeggioHz = 396 | 417 | 528 | 639;

export type UnifiedFrequencyRecommendation = {
  frequencyHz: SolfeggioHz;
  soundId: SolfeggioSoundId;
  advisoryMessage: string;
  /** 心拍・スッキリ度・スキャン板などの補足行 */
  detailLines: string[];
  confidence: "high" | "medium" | "low";
};

const SOLFEGGIO: Record<
  SolfeggioSoundId,
  { frequencyHz: SolfeggioHz; baseMessage: string }
> = {
  s1: {
    frequencyHz: 396,
    baseMessage:
      "少し心が興奮状態にあるようです。まずは恐怖や不安を解放し、心をリセットしましょう",
  },
  s2: {
    frequencyHz: 417,
    baseMessage:
      "今日1日の疲れやマイナスなエネルギーをクリアにして、心身の回復を促します",
  },
  s3: {
    frequencyHz: 528,
    baseMessage:
      "理想的なリラックス状態です。奇跡の周波数528Hzで細胞から癒やされましょう",
  },
  s4: {
    frequencyHz: 639,
    baseMessage:
      "すでに深く落ち着いています。より深い調和とつながりの波動を響かせます",
  },
};

function toRec(
  soundId: SolfeggioSoundId,
  detailLines: string[],
  confidence: UnifiedFrequencyRecommendation["confidence"],
  messageOverride?: string,
): UnifiedFrequencyRecommendation {
  const s = SOLFEGGIO[soundId];
  return {
    soundId,
    frequencyHz: s.frequencyHz,
    advisoryMessage: messageOverride ?? s.baseMessage,
    detailLines,
    confidence,
  };
}

/** 心拍 BPM のみ（従来ロジック） */
export function recommendFromBpm(bpm: number): UnifiedFrequencyRecommendation {
  if (bpm >= 85) return toRec("s1", [], "high");
  if (bpm >= 75) return toRec("s2", [], "high");
  if (bpm >= 60) return toRec("s3", [], "high");
  return toRec("s4", [], "high");
}

function avgWakeScore(rows: SleepLogRow[]): number | null {
  const scores = rows.map((r) => r.wake_score).filter(Number.isFinite);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** 睡眠ログのスッキリ度（1〜5）からの推奨 */
export function recommendFromWakeScore(
  avgScore: number,
): UnifiedFrequencyRecommendation {
  if (avgScore <= 2) {
    return toRec(
      "s2",
      [
        `直近の目覚めスッキリ度は平均 ${avgScore.toFixed(1)} と低めです。回復・変化の 417Hz でリズムを整えましょう。`,
      ],
      "medium",
      "スッキリ度が低い日が続いています。疲れを手放す 417Hz から始めるのがおすすめです",
    );
  }
  if (avgScore <= 3.2) {
    return toRec(
      "s3",
      [
        `スッキリ度平均 ${avgScore.toFixed(1)}。バランスを取り戻す 528Hz が合いやすい状態です。`,
      ],
      "medium",
    );
  }
  if (avgScore >= 4) {
    return toRec(
      "s4",
      [
        `スッキリ度平均 ${avgScore.toFixed(1)} と良好です。深い調和の 639Hz で状態を維持しましょう。`,
      ],
      "medium",
      "目覚めの質が安定しています。より深いつながりの 639Hz がフィットしやすいです",
    );
  }
  return toRec(
    "s3",
    [`スッキリ度平均 ${avgScore.toFixed(1)}。修復の 528Hz を基調にしてください。`],
    "medium",
  );
}

/** 履歴でスッキリ度が最も高かった音 */
function recommendFromHistory(
  rows: SleepLogRow[],
): UnifiedFrequencyRecommendation | null {
  const bySound = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.sound_id.startsWith("s")) continue;
    const list = bySound.get(r.sound_id) ?? [];
    list.push(r.wake_score);
    bySound.set(r.sound_id, list);
  }

  let bestId: SolfeggioSoundId | null = null;
  let bestAvg = 0;
  let bestCount = 0;

  for (const [id, scores] of bySound) {
    if (!["s1", "s2", "s3", "s4"].includes(id)) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg > bestAvg || (avg === bestAvg && scores.length > bestCount)) {
      bestAvg = avg;
      bestId = id as SolfeggioSoundId;
      bestCount = scores.length;
    }
  }

  if (!bestId || bestCount < 1 || bestAvg < 3) return null;

  const label = labelForSoundId(bestId);
  return toRec(
    bestId,
    [
      `睡眠ログでは ${label} のときのスッキリ度が最高（平均 ${bestAvg.toFixed(1)}・${bestCount}回）です。`,
    ],
    bestCount >= 2 ? "high" : "medium",
    `データ上いちばん相性が良いのは ${label} です。${getSoundWellness(bestId).balanceTip}`,
  );
}

/** 取得板（BPM・ゆらぎ・脈の強さ）による微調整 */
function scanDetailLines(metrics: HeartScanMetrics): string[] {
  const lines: string[] = [];
  if (metrics.fluctuationMs >= 350) {
    lines.push(
      `心拍のゆらぎが ${metrics.fluctuationMs}ms と大きめです。不安・緊張の解放（396Hz）寄りも検討できます。`,
    );
  } else if (metrics.fluctuationMs > 0 && metrics.fluctuationMs < 120) {
    lines.push(
      `心拍リズムは比較的安定（ゆらぎ ${metrics.fluctuationMs}ms）。深い調和（639Hz）も相性が良いです。`,
    );
  }
  if (metrics.amplitude < 2) {
    lines.push(
      "脈の波形が弱めです。再測定するか、ログのスッキリ度を優先して選んでください。",
    );
  }
  return lines;
}

function scanVote(metrics: HeartScanMetrics): SolfeggioSoundId | null {
  if (metrics.fluctuationMs >= 350) return "s1";
  if (metrics.fluctuationMs > 0 && metrics.fluctuationMs < 120) return "s4";
  return null;
}

type Vote = { soundId: SolfeggioSoundId; weight: number };

/**
 * 心拍提案と同じ仕組みで、BPM・取得板・睡眠ログのスッキリ度を統合投票。
 */
export function buildUnifiedRecommendation(input: {
  bpm?: number;
  scanMetrics?: HeartScanMetrics;
  sleepLogRows?: SleepLogRow[];
}): UnifiedFrequencyRecommendation {
  const votes: Vote[] = [];
  const detailLines: string[] = [];
  let confidence: UnifiedFrequencyRecommendation["confidence"] = "medium";

  if (input.bpm != null && Number.isFinite(input.bpm)) {
    const bpmRec = recommendFromBpm(input.bpm);
    votes.push({ soundId: bpmRec.soundId, weight: 3 });
    detailLines.push(`現在の推定心拍 ${input.bpm} BPM を反映しています。`);
  }

  const rows = input.sleepLogRows ?? [];
  const wakeAvg = avgWakeScore(rows);
  if (wakeAvg != null) {
    const wakeRec = recommendFromWakeScore(wakeAvg);
    votes.push({ soundId: wakeRec.soundId, weight: 2 });
    detailLines.push(...wakeRec.detailLines);
  }

  const histRec = rows.length > 0 ? recommendFromHistory(rows) : null;
  if (histRec) {
    votes.push({ soundId: histRec.soundId, weight: 2 });
    detailLines.push(...histRec.detailLines);
    confidence = histRec.confidence;
  }

  if (input.scanMetrics) {
    detailLines.push(...scanDetailLines(input.scanMetrics));
    const sv = scanVote(input.scanMetrics);
    if (sv) votes.push({ soundId: sv, weight: 1 });
    if (!input.scanMetrics.reliable || input.scanMetrics.amplitude < 2) {
      confidence = "low";
    }
  }

  if (votes.length === 0) {
    return toRec("s3", ["記録が増えるとスッキリ度も加味した提案になります。"], "low");
  }

  const totals = new Map<SolfeggioSoundId, number>();
  for (const v of votes) {
    totals.set(v.soundId, (totals.get(v.soundId) ?? 0) + v.weight);
  }

  let winner: SolfeggioSoundId = "s3";
  let maxW = 0;
  for (const [id, w] of totals) {
    if (w > maxW) {
      maxW = w;
      winner = id;
    }
  }

  const bpmRec =
    input.bpm != null ? recommendFromBpm(input.bpm) : null;
  const message =
    bpmRec?.soundId === winner
      ? bpmRec.advisoryMessage
      : histRec?.soundId === winner
        ? histRec.advisoryMessage
        : SOLFEGGIO[winner].baseMessage;

  if (votes.length >= 3 && maxW >= 4) confidence = "high";

  return toRec(winner, detailLines, confidence, message);
}
