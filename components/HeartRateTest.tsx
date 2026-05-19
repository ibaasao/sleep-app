"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

const SAMPLE_W = 72;
const SAMPLE_H = 54;
const MEASURE_MS = 5000;
const MIN_PEAK_INTERVAL_MS = 380;

export type HeartRateSessionPreset = {
  frequencyHz: 396 | 417 | 528 | 639;
  soundId: "s1" | "s2" | "s3" | "s4";
  bpm: number;
  advisoryMessage: string;
  requestId?: number;
};

type Phase = "idle" | "measuring" | "result";

type Props = {
  className?: string;
  onSessionStart?: (preset: HeartRateSessionPreset) => void;
};

function recommendFromBpm(bpm: number): Omit<HeartRateSessionPreset, "requestId" | "bpm"> {
  if (bpm >= 85) {
    return {
      frequencyHz: 396,
      soundId: "s1",
      advisoryMessage:
        "少し心が興奮状態にあるようです。まずは恐怖や不安を解放し、心をリセットしましょう",
    };
  }
  if (bpm >= 75) {
    return {
      frequencyHz: 417,
      soundId: "s2",
      advisoryMessage:
        "今日1日の疲れやマイナスなエネルギーをクリアにして、心身の回復を促します",
    };
  }
  if (bpm >= 60) {
    return {
      frequencyHz: 528,
      soundId: "s3",
      advisoryMessage:
        "理想的なリラックス状態です。奇跡の周波数528Hzで細胞から癒やされましょう",
    };
  }
  return {
    frequencyHz: 639,
    soundId: "s4",
    advisoryMessage:
      "すでに深く落ち着いています。より深い調和とつながりの波動を響かせます",
  };
}

function computeBpmFromPeaks(peaks: number[]): {
  bpm: number;
  reliable: boolean;
} {
  const filtered = [...peaks].sort((a, b) => a - b);
  if (filtered.length < 2) {
    return { bpm: 72, reliable: false };
  }
  const ivals: number[] = [];
  for (let i = 1; i < filtered.length; i += 1) {
    const d = filtered[i] - filtered[i - 1];
    if (d >= 300 && d <= 2000) ivals.push(d);
  }
  if (ivals.length === 0) {
    return { bpm: 72, reliable: false };
  }
  const mean = ivals.reduce((a, b) => a + b, 0) / ivals.length;
  const bpm = Math.round(60000 / mean);
  return { bpm: Math.min(220, Math.max(40, bpm)), reliable: true };
}

type HeartScanMetrics = {
  bpm: number;
  fluctuationMs: number;
  amplitude: number;
  reliable: boolean;
};

function computeHeartScanMetrics(
  peaks: number[],
  rawSignals: number[],
): HeartScanMetrics {
  const sortedPeaks = [...peaks].sort((a, b) => a - b);
  const bpmFromPeaks =
    sortedPeaks.length > 0
      ? Math.round((sortedPeaks.length / (MEASURE_MS / 1000)) * 60)
      : 72;

  const intervals: number[] = [];
  for (let i = 1; i < sortedPeaks.length; i += 1) {
    const d = sortedPeaks[i] - sortedPeaks[i - 1];
    if (d >= 300 && d <= 2000) intervals.push(d);
  }

  const fluctuationMs =
    intervals.length >= 2 ? Math.max(...intervals) - Math.min(...intervals) : 0;

  const amplitude =
    rawSignals.length >= 2
      ? Math.max(...rawSignals) - Math.min(...rawSignals)
      : 0;

  return {
    bpm: Math.min(220, Math.max(40, bpmFromPeaks)),
    fluctuationMs: Math.round(fluctuationMs),
    amplitude: Math.round(amplitude * 10) / 10,
    reliable: sortedPeaks.length >= 2 && rawSignals.length > 10,
  };
}

export function HeartRateTest({ className = "", onSessionStart }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const prevAcRef = useRef(0);
  const prevPrevAcRef = useRef(0);
  const emaTrendRef = useRef(0);
  const emaSignalRef = useRef(0);
  const lastPeakTimeRef = useRef(0);
  const measureStartRef = useRef(0);
  const measurementPeaksRef = useRef<number[]>([]);
  const rawSignalsRef = useRef<number[]>([]);

  const pulseVisualRef = useRef(0);
  const ringRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const countdownSecRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [resultBpm, setResultBpm] = useState<number | null>(null);
  const [bpmReliable, setBpmReliable] = useState(true);
  const [scanMetrics, setScanMetrics] = useState<HeartScanMetrics | null>(null);
  const [resultPreset, setResultPreset] = useState<HeartRateSessionPreset | null>(
    null,
  );

  const cancelRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const releaseCamera = useCallback(async () => {
    cancelRaf();
    const stream = streamRef.current;
    if (stream) {
      const [track] = stream.getVideoTracks();
      if (track) {
        try {
          const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
            torch?: boolean;
          };
          if (caps?.torch) {
            await track.applyConstraints({
              advanced: [{ torch: false } as MediaTrackConstraintSet],
            });
          }
        } catch {
          /* ignore */
        }
      }
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
  }, [cancelRaf]);

  const resetVisualRing = useCallback(() => {
    pulseVisualRef.current = 0;
    if (ringRef.current) {
      ringRef.current.style.transform = "scale(1)";
      ringRef.current.style.opacity = "0.55";
      ringRef.current.style.boxShadow = "0 0 24px rgba(167,139,250,0.35)";
    }
    if (glowRef.current) {
      glowRef.current.style.background =
        "radial-gradient(circle at 50% 50%, rgba(167,139,250,0.05) 0%, transparent 55%)";
    }
  }, []);

  const backToIdle = useCallback(async () => {
    await releaseCamera();
    setPhase("idle");
    setCountdown(null);
    setResultBpm(null);
    setScanMetrics(null);
    setResultPreset(null);
    setBpmReliable(true);
    resetVisualRing();
    measurementPeaksRef.current = [];
    rawSignalsRef.current = [];
    countdownSecRef.current = null;
    prevAcRef.current = 0;
    prevPrevAcRef.current = 0;
    emaTrendRef.current = 0;
    emaSignalRef.current = 0;
    lastPeakTimeRef.current = 0;
  }, [releaseCamera, resetVisualRing]);

  const finishMeasurementWindow = useCallback(() => {
    cancelRaf();
    void releaseCamera();

    const start = measureStartRef.current;
    const peaks = measurementPeaksRef.current.filter(
      (t) => t >= start && t <= start + MEASURE_MS,
    );
    const metrics = computeHeartScanMetrics(peaks, rawSignalsRef.current);
    const { bpm, reliable } = metrics;
    const rec = recommendFromBpm(bpm);
    const preset: HeartRateSessionPreset = {
      ...rec,
      bpm,
      requestId: Date.now(),
    };

    setResultBpm(bpm);
    setBpmReliable(reliable);
    setScanMetrics(metrics);
    setResultPreset(preset);
    setPhase("result");
    setCountdown(null);
    countdownSecRef.current = null;
    resetVisualRing();
  }, [cancelRaf, releaseCamera, resetVisualRing]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const ctx2d = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx2d) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();
    const start = measureStartRef.current;
    const elapsed = now - start;

    if (elapsed >= MEASURE_MS) {
      finishMeasurementWindow();
      return;
    }

    const secLeft = Math.ceil((MEASURE_MS - elapsed) / 1000);
    const cd = Math.min(5, Math.max(1, secLeft));
    if (countdownSecRef.current !== cd) {
      countdownSecRef.current = cd;
      setCountdown(cd);
    }

    ctx2d.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
    const { data } = ctx2d.getImageData(0, 0, SAMPLE_W, SAMPLE_H);

    let sumR = 0;
    const n = SAMPLE_W * SAMPLE_H;
    for (let i = 0; i < data.length; i += 4) {
      sumR += data[i];
    }
    const avgR = sumR / n;
    rawSignalsRef.current.push(avgR);

    const trendAlpha = 0.04;
    emaTrendRef.current =
      trendAlpha * avgR + (1 - trendAlpha) * emaTrendRef.current;

    const ac = avgR - emaTrendRef.current;
    const sigAlpha = 0.35;
    emaSignalRef.current =
      sigAlpha * ac + (1 - sigAlpha) * emaSignalRef.current;

    const s = emaSignalRef.current;
    const prev = prevAcRef.current;
    const prevPrev = prevPrevAcRef.current;

    const localMax = s < prev && prev > prevPrev && prev > 0.22;

    if (localMax && now - lastPeakTimeRef.current >= MIN_PEAK_INTERVAL_MS) {
      lastPeakTimeRef.current = now;
      measurementPeaksRef.current.push(now);
      pulseVisualRef.current = 1;
    } else {
      pulseVisualRef.current = Math.max(
        0,
        pulseVisualRef.current * 0.92 - 0.008,
      );
    }

    const p = pulseVisualRef.current;
    const ring = ringRef.current;
    const glow = glowRef.current;
    if (ring) {
      const scale = 1 + p * 0.14;
      ring.style.transform = `scale(${scale})`;
      ring.style.opacity = String(0.55 + p * 0.45);
      ring.style.boxShadow = `0 0 ${24 + p * 32}px rgba(167,139,250,${
        0.35 + p * 0.4
      })`;
    }
    if (glow) {
      const g = 0.35 + p * 0.55;
      glow.style.background = `radial-gradient(circle at 50% 50%, rgba(167,139,250,${
        g * 0.12
      }) 0%, transparent 55%)`;
    }

    prevPrevAcRef.current = prev;
    prevAcRef.current = s;

    rafRef.current = requestAnimationFrame(tick);
  }, [finishMeasurementWindow]);

  const startMeasure = useCallback(async () => {
    setError(null);
    setResultBpm(null);
    setScanMetrics(null);
    setResultPreset(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("このブラウザではカメラ API を利用できません。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        await backToIdle();
        return;
      }
      video.srcObject = stream;
      await video.play();

      let torchEnabled = false;
      const [track] = stream.getVideoTracks();
      if (track?.getCapabilities) {
        const caps = track.getCapabilities() as MediaTrackCapabilities & {
          torch?: boolean;
        };
        if (caps.torch) {
          try {
            await track.applyConstraints({
              advanced: [{ torch: true } as MediaTrackConstraintSet],
            });
            torchEnabled = true;
          } catch {
            torchEnabled = false;
          }
        }
      }
      setTorchOn(torchEnabled);

      measurementPeaksRef.current = [];
      rawSignalsRef.current = [];
      prevAcRef.current = 0;
      prevPrevAcRef.current = 0;
      emaTrendRef.current = 0;
      emaSignalRef.current = 0;
      lastPeakTimeRef.current = 0;
      measureStartRef.current = performance.now();
      pulseVisualRef.current = 0;
      countdownSecRef.current = null;
      setCountdown(5);
      setPhase("measuring");
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "カメラの起動に失敗しました。";
      setError(msg);
      await backToIdle();
    }
  }, [backToIdle, tick]);

  const cancelMeasure = useCallback(async () => {
    await backToIdle();
  }, [backToIdle]);

  const handleOk = useCallback(() => {
    if (!resultPreset) return;
    onSessionStart?.({
      ...resultPreset,
      requestId: Date.now(),
    });
  }, [resultPreset, onSessionStart]);

  useEffect(() => {
    return () => {
      void releaseCamera();
    };
  }, [releaseCamera]);

  const showPreview = phase === "measuring";

  return (
    <section
      className={`w-full max-w-md rounded-2xl border border-violet-500/30 bg-gradient-to-b from-slate-950/95 to-[#0a0f1a] p-5 shadow-[0_0_40px_-12px_rgba(139,92,246,0.45)] backdrop-blur-sm ${className}`}
      aria-label="心拍シンク テスト"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300/85">
        PPG Lab
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">
        心拍から周波数提案
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        「測定スタート」後、5・4・3・2・1のカウントに合わせて約5秒間、指で背面レンズを軽く覆ってください。赤チャンネルの波から平均BPMを推定し、おすすめの周波数を表示します。
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      <div
        className={`relative mt-4 overflow-hidden rounded-xl border border-slate-700/80 bg-black/60 ${
          phase === "result" ? "min-h-[200px]" : ""
        }`}
      >
        {/* idle 中も ref が付くよう video/canvas は常にマウント（測定開始直後に null にならない） */}
        <video
          ref={videoRef}
          className={
            showPreview
              ? "aspect-[4/3] h-auto w-full object-cover opacity-90"
              : "pointer-events-none absolute left-0 top-0 -z-10 h-px w-px opacity-0"
          }
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          width={SAMPLE_W}
          height={SAMPLE_H}
          className="hidden"
          aria-hidden
        />
        {showPreview ? (
          <>
            <div
              ref={glowRef}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(167,139,250,0.05) 0%, transparent 55%)",
              }}
            >
              <div
                ref={ringRef}
                className="h-24 w-24 rounded-full border-2 border-violet-400/70 bg-violet-500/10 transition-[transform,opacity,box-shadow] duration-75 ease-out"
                style={{
                  transform: "scale(1)",
                  opacity: 0.55,
                  boxShadow: "0 0 24px rgba(167,139,250,0.35)",
                }}
              />
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
              <span className="font-mono text-7xl font-bold tabular-nums text-white drop-shadow-[0_0_24px_rgba(167,139,250,0.9)] sm:text-8xl">
                {countdown ?? ""}
              </span>
            </div>
          </>
        ) : phase === "result" ? (
          <div className="flex min-h-[220px] items-center justify-center bg-gradient-to-b from-slate-900/90 to-[#0a0f1a] p-6">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-full text-center"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300/85">
                測定結果
              </p>
              <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-white sm:text-4xl">
                {resultBpm != null ? `~${resultBpm} BPM` : "—"}
              </p>
              {!bpmReliable ? (
                <p className="mt-1 text-[10px] text-amber-200/80">
                  波形が弱いため値は参考です。必要なら再測定してください。
                </p>
              ) : null}
              {resultPreset ? (
                <>
                  <p className="mt-5 text-sm font-bold text-violet-200">
                    おすすめ:{" "}
                    <span className="text-fuchsia-200">
                      {resultPreset.frequencyHz} Hz
                    </span>
                  </p>
                  <p className="mt-3 text-left text-xs leading-relaxed text-slate-300">
                    {resultPreset.advisoryMessage}
                  </p>
                </>
              ) : null}
              {scanMetrics ? (
                <div className="mt-5 grid grid-cols-3 gap-2 text-left">
                  <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-300/80">
                      BPM
                    </p>
                    <p className="mt-1 font-mono text-sm text-white">
                      {scanMetrics.bpm}
                    </p>
                  </div>
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300/80">
                      ゆらぎ
                    </p>
                    <p className="mt-1 font-mono text-sm text-white">
                      {scanMetrics.fluctuationMs}ms
                    </p>
                  </div>
                  <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-fuchsia-300/80">
                      脈の強さ
                    </p>
                    <p className="mt-1 font-mono text-sm text-white">
                      {scanMetrics.amplitude}
                    </p>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-slate-900/80">
            <p className="px-6 text-center text-xs text-slate-500">
              測定スタートでカメラが起動します
            </p>
          </div>
        )}
      </div>

      {phase === "measuring" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {torchOn ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200/90 ring-1 ring-amber-400/40">
              ライト ON
            </span>
          ) : (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">
              ライト未対応 / オフ
            </span>
          )}
          <span className="text-violet-300/80">
            測定中… 残り約{countdown ?? 0}秒
          </span>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {phase === "result" && resultPreset ? (
          <motion.div
            key="actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className="mt-4 flex flex-col gap-3"
          >
            <motion.button
              type="button"
              onClick={handleOk}
              className="touch-manipulation w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_0_28px_-6px_rgba(167,139,250,0.65)] transition hover:from-violet-500 hover:to-fuchsia-500 active:scale-[0.98]"
              whileTap={{ scale: 0.98 }}
            >
              この周波数でセッションを開始する（OK）
            </motion.button>
            <button
              type="button"
              onClick={() => void backToIdle()}
              className="touch-manipulation w-full rounded-xl border border-slate-600/80 bg-slate-900/50 px-4 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800/60"
            >
              もう一度測定する
            </button>
          </motion.div>
        ) : phase === "idle" ? (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4"
          >
            <button
              type="button"
              onClick={() => void startMeasure()}
              className="touch-manipulation w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_-4px_rgba(167,139,250,0.65)] transition hover:from-violet-500 hover:to-fuchsia-500 active:scale-[0.98]"
            >
              測定スタート
            </button>
          </motion.div>
        ) : phase === "measuring" ? (
          <motion.div
            key="cancel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4"
          >
            <button
              type="button"
              onClick={() => void cancelMeasure()}
              className="touch-manipulation w-full rounded-xl border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-900/50 active:scale-[0.98]"
            >
              キャンセル
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
