"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";

const FADE_SECONDS = 8;
/** メインに重ねる奥行き用オシレーターの周波数オフセット（Hz） */
const DEPTH_DETUNE_HZ = 1;
/** Delta / Theta の基準周波数（低めで耳当たりを柔らかく） */
const BINAURAL_BASE_FREQ_HZ = 150;
/** Delta / Theta の高域を削るローパス（Hz） */
const BINAURAL_LPF_HZ = 200;
/** Pink Noise のローパス（Hz）— これより高い帯域を落としてこもった質感に */
const PINK_NOISE_LPF_HZ = 1000;
/** Deep Ocean のローパス上限（Hz） */
const DEEP_OCEAN_LPF_HZ = 400;
/** Deep Ocean の AutoFilter 周期（秒） */
const DEEP_OCEAN_SWELL_SEC = 15;

/** ルーム残響のウェット量（ドライとのバランス） */
const REVERB_WET = 0.4;
/** 残響の減衰時間（秒）—長めで空間感を強調 */
const REVERB_DECAY_SEC = 6;
const TIMER_OPTIONS = [15, 30, 60] as const;
type TimerMinutes = (typeof TIMER_OPTIONS)[number];

type ToneType = "solfeggio" | "sleep";

interface Sound {
  id: string;
  type: ToneType;
  label: string;
  freq?: number;
  description: string;
  noiseType?: Tone.NoiseType;
  audioUrl?: string;
}

const SOUND_LIST: Sound[] = [
  {
    id: "s1",
    type: "solfeggio",
    label: "396 Hz",
    freq: 396,
    description: "恐怖からの解放",
  },
  {
    id: "s2",
    type: "solfeggio",
    label: "417 Hz",
    freq: 417,
    description: "変化の促進・回復",
  },
  {
    id: "s3",
    type: "solfeggio",
    label: "528 Hz",
    freq: 528,
    description: "DNA修復・愛の周波数",
  },
  {
    id: "s4",
    type: "solfeggio",
    label: "639 Hz",
    freq: 639,
    description: "人間関係・つながり",
  },
  {
    id: "s5",
    type: "solfeggio",
    label: "741 Hz",
    freq: 741,
    description: "表現力・問題解決",
  },
  {
    id: "s6",
    type: "solfeggio",
    label: "852 Hz",
    freq: 852,
    description: "直感・精神性の向上",
  },
  {
    id: "n1",
    type: "sleep",
    label: "Brown Noise",
    noiseType: "brown",
    description: "深い滝のような音",
  },
  {
    id: "n2",
    type: "sleep",
    label: "Pink Noise",
    noiseType: "pink",
    description: "心地よい雨のような音",
  },
  {
    id: "n3",
    type: "sleep",
    label: "Delta Wave",
    freq: BINAURAL_BASE_FREQ_HZ,
    description: "深い眠り",
  },
  {
    id: "n4",
    type: "sleep",
    label: "Theta Wave",
    freq: BINAURAL_BASE_FREQ_HZ,
    description: "深い瞑想",
  },
  {
    id: "n5",
    type: "sleep",
    label: "Deep Ocean",
    noiseType: "brown",
    description: "海のうねりのように低くゆらぐ音",
  },
  {
    id: "n6",
    type: "sleep",
    label: "Cosmic Humming",
    freq: 63.3,
    description: "528Hz・432Hz・63.3Hz を重ねた宇宙的ハミング",
  },
  // 既存のリストの最後に追加
  {
    id: 'rain',
    type: "sleep",
    label: 'Rainy Night',
    description: '落ち着く雨の音', 
    audioUrl: 'https://lnllkcuiwiuppeaobhxs.supabase.co/storage/v1/object/public/sounds/rain.mp3',
  },

];

/** sleep_logs.notes に保存する JSON（Supabase では jsonb） */
export type SleepLogNotes = {
  label: string;
  minutes: number;
  frequency_hz: number | null;
};

type SleepLogRow = {
  id: string;
  user_id: string;
  played_at: string;
  created_at?: string;
  notes?: SleepLogNotes | Record<string, unknown> | null;
};

function buildNotesPayload(
  sound: Sound,
  minutes: TimerMinutes,
): SleepLogNotes {
  const frequency_hz =
    sound.noiseType != null ? null : (sound.freq ?? null);
  return {
    label: sound.label,
    minutes,
    frequency_hz,
  };
}

function describeHistoryNotes(raw: unknown): {
  title: string;
  detail: string;
} {
  if (!raw || typeof raw !== "object") {
    return { title: "不明なサウンド", detail: "" };
  }

  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label : null;
  if (!label) {
    return { title: "不明なサウンド", detail: "" };
  }

  const minutes =
    typeof o.minutes === "number" && Number.isFinite(o.minutes)
      ? o.minutes
      : null;
  const legacy = o._legacy === true;

  if (legacy || minutes === null) {
    return { title: label, detail: "" };
  }

  const freqPart =
    typeof o.frequency_hz === "number" && Number.isFinite(o.frequency_hz)
      ? `${o.frequency_hz} Hz`
      : "ノイズ（周波数なし）";

  return {
    title: label,
    detail: `${minutes}分 · ${freqPart}`,
  };
}

async function recordSleepLogAtPlay(
  playedAtIso: string,
  notes: SleepLogNotes,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("sleep_logs").insert({
    user_id: user.id,
    played_at: playedAtIso,
    notes,
  });

  if (error) {
    console.error("[sleep_logs]", error.message);
  }
}

export function HealingToneButton() {
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("s3");
  const [minutes, setMinutes] = useState<TimerMinutes>(30);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [history, setHistory] = useState<SleepLogRow[]>([]);

  const sourceRef = useRef<Tone.Oscillator | Tone.Noise | null>(null);
  const secondOscRef = useRef<Tone.Oscillator | null>(null);
  const thirdOscRef = useRef<Tone.Oscillator | null>(null);
  /** メインより DEPTH_DETUNE_HZ だけ高い周波数で重ねるレイヤー（ノイズ時は未使用） */
  const depthOscRef = useRef<Tone.Oscillator | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  /** Pink Noise 用ローパス（他ノイズ・トーンでは未使用） */
  const noiseFilterRef = useRef<Tone.Filter | null>(null);
  /** Deep Ocean 用のゆっくり開閉する AutoFilter */
  const oceanAutoFilterRef = useRef<Tone.AutoFilter | null>(null);
  /** Delta / Theta 用ローパス（左右） */
  const binauralFilterLRef = useRef<Tone.Filter | null>(null);
  const binauralFilterRRef = useRef<Tone.Filter | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopScheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endAtRef = useRef<number>(0);

  const currentSound =
    SOUND_LIST.find((s) => s.id === selectedId) || SOUND_LIST[2];

  const fetchHistory = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setHistory([]);
      return;
    }

    const { data, error } = await supabase
      .from("sleep_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("played_at", { ascending: false })
      .limit(5);

    if (!error && data) {
      setHistory(data as SleepLogRow[]);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const clearTimers = useCallback(() => {
    if (stopScheduleRef.current != null) {
      clearTimeout(stopScheduleRef.current);
      stopScheduleRef.current = null;
    }
    if (fadeTimerRef.current != null) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const disposeSources = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.dispose();
      sourceRef.current = null;
    }
    if (secondOscRef.current) {
      secondOscRef.current.stop();
      secondOscRef.current.dispose();
      secondOscRef.current = null;
    }
    if (thirdOscRef.current) {
      thirdOscRef.current.stop();
      thirdOscRef.current.dispose();
      thirdOscRef.current = null;
    }
    if (depthOscRef.current) {
      depthOscRef.current.stop();
      depthOscRef.current.dispose();
      depthOscRef.current = null;
    }
    if (oceanAutoFilterRef.current) {
      oceanAutoFilterRef.current.stop();
      oceanAutoFilterRef.current.dispose();
      oceanAutoFilterRef.current = null;
    }
    if (noiseFilterRef.current) {
      noiseFilterRef.current.dispose();
      noiseFilterRef.current = null;
    }
    if (binauralFilterLRef.current) {
      binauralFilterLRef.current.dispose();
      binauralFilterLRef.current = null;
    }
    if (binauralFilterRRef.current) {
      binauralFilterRRef.current.dispose();
      binauralFilterRRef.current = null;
    }
    if (reverbRef.current) {
      reverbRef.current.dispose();
      reverbRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    clearTimers();
    disposeSources();
    Tone.Destination.mute = true;
    setPlaying(false);
    setRemainingSec(null);
    void fetchHistory();
  }, [clearTimers, disposeSources, fetchHistory]);

  const beginFadeOut = useCallback(() => {
    if (!sourceRef.current) return;

    stopScheduleRef.current = null;

    sourceRef.current.volume.rampTo(-80, FADE_SECONDS);
    secondOscRef.current?.volume.rampTo(-80, FADE_SECONDS);
    thirdOscRef.current?.volume.rampTo(-80, FADE_SECONDS);
    depthOscRef.current?.volume.rampTo(-80, FADE_SECONDS);

    fadeTimerRef.current = setTimeout(() => {
      fadeTimerRef.current = null;
      clearTimers();
      disposeSources();
      setPlaying(false);
      setRemainingSec(null);
      void fetchHistory();
    }, FADE_SECONDS * 1000 + 120);
  }, [clearTimers, disposeSources, fetchHistory]);

  const startPlayback = useCallback(async () => {
    await Tone.start();
    // 👇 これを追加！フタを開ける（ミュート解除）
    Tone.Destination.mute = false;
    clearTimers();
    disposeSources();

    const durationMs = minutes * 60 * 1000;
    const waitMs = Math.max(0, durationMs - FADE_SECONDS * 1000);

    const reverb = new Tone.Reverb(REVERB_DECAY_SEC);
    reverb.wet.value = REVERB_WET;
    await reverb.generate();
    reverb.toDestination();
    reverbRef.current = reverb;


    if (currentSound.id === "rain") {
      const player = new Tone.Player(currentSound.audioUrl).toDestination();
      await Tone.loaded();
      player.start();
      setPlaying(true);
      return;
    }

    if (currentSound.noiseType) {
      if (currentSound.id === "n5") {
        const ocean = new Tone.AutoFilter({
          frequency: 1 / DEEP_OCEAN_SWELL_SEC,
          depth: 1,
          baseFrequency: DEEP_OCEAN_LPF_HZ / 4,
          octaves: 2,
        }).connect(reverb);
        ocean.filter.type = "lowpass";
        ocean.filter.rolloff = -24;
        ocean.filter.Q.value = 0.6;
        ocean.wet.value = 1;
        ocean.start();

        const noise = new Tone.Noise("brown").connect(ocean);
        noise.volume.value = -22;
        sourceRef.current = noise;
        oceanAutoFilterRef.current = ocean;
      } else if (currentSound.noiseType === "pink") {
        const lp = new Tone.Filter({
          type: "lowpass",
          frequency: PINK_NOISE_LPF_HZ,
          rolloff: -24,
        });
        lp.Q.value = 0.7;
        const noise = new Tone.Noise("pink").connect(lp);
        lp.connect(reverb);
        noise.volume.value = -20;
        sourceRef.current = noise;
        noiseFilterRef.current = lp;
      } else {
        const noise = new Tone.Noise(currentSound.noiseType).connect(reverb);
        noise.volume.value = -20;
        sourceRef.current = noise;
      }
    } else if (currentSound.id === "n6") {
      // 528Hz（愛）/ 432Hz（宇宙）/ 63.3Hz（地球の鼓動）を
      // 音量バランスを変えて重ねる。
      const oscA = new Tone.Oscillator(528, "sine").connect(reverb);
      const oscB = new Tone.Oscillator(432, "sine").connect(reverb);
      const oscC = new Tone.Oscillator(63.3, "sine").connect(reverb);
      oscA.volume.value = -30;
      oscB.volume.value = -28;
      oscC.volume.value = -20;
      // わずかな detune で静かなうねりを加える
      oscA.detune.value = -1.5;
      oscB.detune.value = 1.2;
      oscC.detune.value = -0.8;
      sourceRef.current = oscA;
      secondOscRef.current = oscB;
      thirdOscRef.current = oscC;
    } else if (currentSound.id === "n3" || currentSound.id === "n4") {
      // 左右パンを最大に広げ、各チャンネルを 200Hz ローパスして「ザー」感を抑える。
      const pannerL = new Tone.Panner(-1).connect(reverb);
      const pannerR = new Tone.Panner(1).connect(reverb);
      const lowpassL = new Tone.Filter({
        type: "lowpass",
        frequency: BINAURAL_LPF_HZ,
        rolloff: -24,
      }).connect(pannerL);
      const lowpassR = new Tone.Filter({
        type: "lowpass",
        frequency: BINAURAL_LPF_HZ,
        rolloff: -24,
      }).connect(pannerR);
      binauralFilterLRef.current = lowpassL;
      binauralFilterRRef.current = lowpassR;

      const oscL = new Tone.Oscillator(currentSound.freq!, "sine").connect(
        lowpassL,
      );
      const diff = currentSound.id === "n3" ? 3 : 6;
      const oscR = new Tone.Oscillator(
        currentSound.freq! + diff,
        "triangle",
      ).connect(lowpassR);
      oscL.volume.value = -30;
      oscR.volume.value = -30;
      sourceRef.current = oscL;
      secondOscRef.current = oscR;
    } else {
      const f = currentSound.freq!;
      const osc = new Tone.Oscillator(f, "sine").connect(reverb);
      osc.volume.value = -14;
      const depth = new Tone.Oscillator(
        f + DEPTH_DETUNE_HZ,
        "triangle",
      ).connect(reverb);
      depth.volume.value = -17;
      sourceRef.current = osc;
      depthOscRef.current = depth;
    }

    const playedAtIso = new Date().toISOString();
    sourceRef.current.start();
    secondOscRef.current?.start();
    thirdOscRef.current?.start();
    depthOscRef.current?.start();

    void recordSleepLogAtPlay(
      playedAtIso,
      buildNotesPayload(currentSound, minutes),
    );

    endAtRef.current = Date.now() + durationMs;
    setRemainingSec(Math.ceil(durationMs / 1000));
    setPlaying(true);

    stopScheduleRef.current = setTimeout(() => {
      beginFadeOut();
    }, waitMs);
  }, [currentSound, minutes, beginFadeOut, clearTimers, disposeSources]);

  useEffect(() => {
    if (!playing) return;

    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((endAtRef.current - Date.now()) / 1000),
      );
      setRemainingSec(left);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    return () => {
      clearTimers();
      disposeSources();
    };
  }, [clearTimers, disposeSources]);

  const formatRemaining = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-auto min-h-[600px] w-full max-w-5xl flex-col rounded-xl border border-slate-800 bg-[#0a0a0a] text-slate-200 shadow-2xl">
      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 border-r border-slate-800 bg-[#0f0f0f] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Timer
          </h2>
          <div className="flex flex-col gap-2">
            {TIMER_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={playing}
                onClick={() => setMinutes(m)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                  minutes === m
                    ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/50"
                    : "text-slate-400 hover:bg-slate-800"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {m}分
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col p-6">
          <header className="mb-4 flex items-start justify-between gap-4">
            <h1 className="text-xl font-bold">Sound Library</h1>
            {playing && remainingSec !== null && (
              <div className="text-right">
                <p className="animate-pulse text-[10px] uppercase text-violet-400">
                  Now Playing
                </p>
                <p className="font-mono text-lg tabular-nums">
                  {formatRemaining(remainingSec)}
                </p>
              </div>
            )}
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto pb-4">
            {SOUND_LIST.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => !playing && setSelectedId(s.id)}
                disabled={playing}
                className={`rounded-lg border p-4 text-left transition disabled:cursor-not-allowed ${
                  selectedId === s.id
                    ? "border-violet-500 bg-violet-500/5"
                    : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                } ${playing && selectedId !== s.id ? "opacity-40" : ""}`}
              >
                <div className="text-sm font-bold text-white">{s.label}</div>
                <div className="text-xs text-slate-500">{s.description}</div>
              </button>
            ))}
          </div>

          <div className="mt-auto border-t border-slate-800 pt-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              最近の履歴
            </h2>
            <div className="space-y-2">
              {history.length > 0 ? (
                history.map((log) => {
                  const { title, detail } = describeHistoryNotes(log.notes);
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-800/50 bg-slate-900/50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-200">
                          {title}
                        </p>
                        {detail ? (
                          <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        {new Date(log.played_at).toLocaleString("ja-JP", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs italic text-slate-600">
                  履歴がまだありません（ログイン後に再生すると表示されます）
                </p>
              )}
            </div>
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-800 bg-[#0f0f0f] p-6">
        <button
          type="button"
          onClick={() => void (playing ? stopPlayback() : startPlayback())}
          className={`w-full rounded-lg py-4 text-sm font-bold tracking-widest transition ${
            playing
              ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
              : "bg-violet-600 text-white hover:bg-violet-500"
          }`}
        >
          {playing ? "STOP SESSION" : "START SESSION"}
        </button>
      </footer>
    </div>
  );
}
