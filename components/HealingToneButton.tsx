"use client";

import { createClient } from "@/lib/supabase/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AuthNav } from "@/components/AuthNav";
import { HiddenSignalLayer } from "@/components/session/HiddenSignalLayer";
import { NeuralScanHud } from "@/components/session/NeuralScanHud";
import { NeuralImmersionSlider } from "@/components/NeuralImmersionSlider";
import { NeuralSynapseVisualizer } from "@/components/session/NeuralSynapseVisualizer";
import { SessionAmbientField } from "@/components/session/SessionAmbientField";
import { SessionLaunchBurst } from "@/components/session/SessionLaunchBurst";
import { EvolveNeuralHeroOverlay } from "@/components/session/EvolveNeuralHeroOverlay";
import { SyncLockFlash } from "@/components/session/SyncLockFlash";
import {
  QuickMoodDiagnosis,
  type QuickMoodSelection,
} from "@/components/QuickMoodDiagnosis";
import {
  DEFAULT_SOUND_417_SETTINGS,
  Sound417DetailPanel,
  type Sound417Settings,
} from "@/components/Sound417DetailPanel";
import type { HeartRateSessionPreset } from "@/components/HeartRateTest";
import { motion } from "framer-motion";
import * as Tone from "tone";
import {
  SESSION_EVOLVE_REVEAL_MS,
  usePlaybackTimeManager,
} from "@/hooks/usePlaybackTimeManager";

/** Strict Mode 二重マウントでも心拍プリセット適用が二重起動しないようにする */
const appliedHeartPresetRequestIds = new Set<number>();

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
/** Neural Synchronizer（528Hz 選択時）左耳の周波数 */
const NEURAL_SYNC_LEFT_HZ = 528;
/** 右耳は覚醒用に +20Hz（没入度最大時の目安） */
const NEURAL_SYNC_RIGHT_HZ = 548;

/** 没入度 t∈[0,1] から左右の拍差（Hz）。Relax で極小、Ethereal で最大近傍 */
function neuralInterauralBeatHz(immersion: number): number {
  const u = Math.min(1, Math.max(0, immersion));
  return 0.06 + u ** 1.4 * (NEURAL_SYNC_RIGHT_HZ - NEURAL_SYNC_LEFT_HZ - 0.06);
}

function neuralDetuneWobbleHz(immersion: number): number {
  const u = Math.min(1, Math.max(0, immersion));
  return 0.028 + u * u * 2.65;
}

function neuralDetuneWobbleCents(immersion: number): number {
  const u = Math.min(1, Math.max(0, immersion));
  return 1.8 + u * 44;
}

/** ルーム残響のウェット量（ドライとのバランス） */
const REVERB_WET = 0.4;
/** 残響の減衰時間（秒）—長めで空間感を強調 */
const REVERB_DECAY_SEC = 6;

/** 進化前: マスター LPF でこもり感 */
const MASTER_LPF_PRE_HZ = 1280;
/** 進化後: 実質フルレンジ */
const MASTER_LPF_POST_HZ = 20000;
/** 進化前後のマスター線形ゲイン（Web Audio GainNode） */
const MASTER_GAIN_PRE = 0.86;
const MASTER_GAIN_POST = 1.09;

/**
 * 528Hz Pure/Mild（sine / triangle）に応じたハイシェルフゲイン（dB）— 進化後の明瞭さ調整の入口
 */
function shelfGainDbFor528Osc(oscType: Tone.ToneOscillatorType): number {
  if (oscType === "triangle") return 0.35;
  return 2.55;
}
const TIMER_OPTIONS = [15, 30, 60] as const;
type TimerMinutes = (typeof TIMER_OPTIONS)[number];

type StartPlaybackOptions = {
  fadeInSec?: number;
  soundId?: string;
  minutesOverride?: TimerMinutes;
};

type Sound417NativeGraph = {
  context: AudioContext;
  baseOsc: OscillatorNode;
  noiseSource: AudioBufferSourceNode;
  baseGain: GainNode;
  dryGain: GainNode;
  textureGain: GainNode;
  spatialGain: GainNode;
  masterGain: GainNode;
  resonanceFilter: BiquadFilterNode;
  textureFilter: BiquadFilterNode;
  leftDelay: DelayNode;
  rightDelay: DelayNode;
  merger: ChannelMergerNode;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function rampParam(
  param: AudioParam,
  context: BaseAudioContext,
  value: number,
  rampSec = 0.08,
) {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, Math.max(0.006, rampSec / 3));
}

function createNoiseBuffer(context: AudioContext) {
  const seconds = 2;
  const buffer = context.createBuffer(
    1,
    Math.floor(context.sampleRate * seconds),
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    // 少し積分して、雨っぽい柔らかいノイズに寄せる。
    last = last * 0.985 + white * 0.015;
    data[i] = last * 2.7;
  }
  return buffer;
}

function applyNativeSound417Settings(
  graph: Sound417NativeGraph,
  settings: Sound417Settings,
  rampSec = 0.08,
) {
  const r = clamp01(settings.resonanceIntensity);
  const texture = clamp01(settings.textureMix);
  const spatial = clamp01(settings.spatializer);
  const { context } = graph;

  graph.resonanceFilter.type = "bandpass";
  rampParam(graph.resonanceFilter.frequency, context, 417, rampSec);
  rampParam(graph.resonanceFilter.Q, context, 0.85 + r * 16, rampSec);
  rampParam(graph.baseGain.gain, context, 0.055 + r * 0.055, rampSec);

  graph.textureFilter.type = "lowpass";
  rampParam(graph.textureFilter.frequency, context, 800 + texture * 4200, rampSec);
  rampParam(graph.textureFilter.Q, context, 0.35 + texture * 1.2, rampSec);
  rampParam(graph.textureGain.gain, context, texture ** 1.35 * 0.055, rampSec);

  rampParam(graph.dryGain.gain, context, 1 - spatial * 0.28, rampSec);
  rampParam(graph.spatialGain.gain, context, spatial * 0.72, rampSec);
  rampParam(graph.leftDelay.delayTime, context, 0.002 + spatial * 0.009, rampSec);
  rampParam(graph.rightDelay.delayTime, context, 0.009 + spatial * 0.044, rampSec);
}

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
  // ★追加ここから
  {
    id: "n7",
    type: "sleep",
    label: "Solstice Breath",
    freq: 528,
    description: "13秒周期で呼吸するように変化する528Hz",
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

type SessionControlValue = {
  playing: boolean;
  toggleSession: () => void;
  isEvolved: boolean;
};

const SessionControlContext = createContext<SessionControlValue | null>(null);

function SessionControlButton() {
  const session = useContext(SessionControlContext);
  if (!session) return null;

  const { playing, toggleSession, isEvolved } = session;

  return (
    <motion.button
      type="button"
      initial={false}
      onClick={() => void toggleSession()}
      whileTap={{ scale: 0.96 }}
      className={`touch-manipulation rounded-full font-bold tracking-wider outline-none ring-offset-2 ring-offset-[#0a0a0a] transition-[box-shadow,transform,colors] duration-100 ${
        playing ? "session-breath-button" : ""
      } ${
        playing
          ? isEvolved
            ? "bg-red-500/15 px-5 py-2.5 text-sm text-red-400 ring-2 ring-red-400/50 ring-offset-2 hover:bg-red-500/25"
            : "bg-red-500/10 px-4 py-1.5 text-sm text-red-500 ring-1 ring-red-500/30 hover:bg-red-500/20"
          : "bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 py-3 text-base text-white shadow-[0_0_32px_-4px_rgba(167,139,250,0.75),0_0_48px_-8px_rgba(244,114,182,0.45)] ring-2 ring-violet-400/60 hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-[0_0_40px_rgba(167,139,250,0.85)] active:brightness-110"
      }`}
      animate={
        playing
          ? isEvolved
            ? { scale: [1, 1.02, 1] }
            : { scale: 1 }
          : {
              scale: [1, 1.035, 1],
              boxShadow: [
                "0 0 28px -4px rgba(167,139,250,0.65), 0 0 40px -8px rgba(244,114,182,0.35)",
                "0 0 40px 0px rgba(167,139,250,0.85), 0 0 56px -4px rgba(244,114,182,0.5)",
                "0 0 28px -4px rgba(167,139,250,0.65), 0 0 40px -8px rgba(244,114,182,0.35)",
              ],
            }
      }
      transition={
        playing && isEvolved
          ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          : !playing
            ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.08 }
      }
    >
      {playing ? "STOP SESSION" : "START SESSION"}
    </motion.button>
  );
}

type HealingToneButtonProps = {
  email: string | null;
  /** 心拍テスト OK 後 — 指定サウンドでセッションを自動開始 */
  heartSessionPreset?: HeartRateSessionPreset | null;
  onHeartSessionConsumed?: () => void;
};

export function HealingToneButton({
  email,
  heartSessionPreset,
  onHeartSessionConsumed,
}: HealingToneButtonProps) {
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("s2");
  const [minutes, setMinutes] = useState<TimerMinutes>(30);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [history, setHistory] = useState<SleepLogRow[]>([]);
  const [oscType, setOscType] = useState<Tone.ToneOscillatorType>("sine");
  const [modType, setModType] = useState<"none" | "breathe" | "vibrate">("none");
  /** 528Hz（s3）— Neural Synchronizer 没入度 0=Relax … 1=Ethereal */
  const [neuralImmersion, setNeuralImmersion] = useState(0);
  const [launchBurst, setLaunchBurst] = useState(false);
  const [alignmentBurstAt, setAlignmentBurstAt] = useState<number | null>(null);
  const [syncLocked, setSyncLocked] = useState(false);
  const lockSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** クイック診断で選んだ周波数（Hz）— Sound Library の選択と同期 */
  const [activeFrequency, setActiveFrequency] = useState<number | null>(null);
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);
  const [quickPortalTarget, setQuickPortalTarget] = useState<
    HTMLElement | "missing" | null
  >(null);
  const [sound417Settings, setSound417Settings] = useState<Sound417Settings>(
    DEFAULT_SOUND_417_SETTINGS,
  );
  const sound417SettingsRef = useRef<Sound417Settings>(sound417Settings);

  const nativeSound417Ref = useRef<Sound417NativeGraph | null>(null);
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
  // ★追加ここから
  /** からくりトリック用の音量揺らし LFO */
  const lfoRef = useRef<Tone.LFO | null>(null);
  // ★追加ここまで
  // /** Delta / Theta 用ローパス（左右） */
  const binauralFilterLRef = useRef<Tone.Filter | null>(null);
  const binauralFilterRRef = useRef<Tone.Filter | null>(null);
  /** Neural Synchronizer 用パンナー（左右） */
  const neuralPannerLRef = useRef<Tone.Panner | null>(null);
  const neuralPannerRRef = useRef<Tone.Panner | null>(null);
  const neuralImmersionRef = useRef(0);
  /** 拍差のうねり（右耳 detune）— modType が vibrate のときは未使用 */
  const neuralBeatLfoRef = useRef<Tone.LFO | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopScheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endAtRef = useRef<number>(0);
  /** マスター出力: 進化前 LPF → 528 音色連動用ハイシェルフ → ゲイン */
  const masterLpfRef = useRef<Tone.Filter | null>(null);
  const masterShelfRef = useRef<Tone.Filter | null>(null);
  const masterGainRef = useRef<Tone.Gain | null>(null);
  /** s3 再生中に構築したゆらぎ LFO がどの modType 向けか（進化後の切替検知用） */
  const modLfoBuiltForModTypeRef = useRef<
    "none" | "breathe" | "vibrate" | null
  >(null);

  const { isEvolved } = usePlaybackTimeManager(playing);

  useEffect(() => {
    sound417SettingsRef.current = sound417Settings;
  }, [sound417Settings]);

  const [evolveAnimStartedAt, setEvolveAnimStartedAt] = useState<number | null>(
    null,
  );
  const evolveHeroDoneRef = useRef(false);
  const [evolveHeroGate, setEvolveHeroGate] = useState(false);

  useEffect(() => {
    if (!playing) {
      setEvolveAnimStartedAt(null);
      return;
    }
    setEvolveAnimStartedAt((prev) =>
      prev == null ? performance.now() : prev,
    );
  }, [playing]);

  useEffect(() => {
    if (!playing) {
      evolveHeroDoneRef.current = false;
      setEvolveHeroGate(false);
      return;
    }
    if (selectedId !== "s3" || syncLocked) {
      setEvolveHeroGate(false);
      return;
    }
    if (evolveHeroDoneRef.current) return;
    evolveHeroDoneRef.current = true;
    setEvolveHeroGate(true);
    const t = window.setTimeout(() => {
      setEvolveHeroGate(false);
    }, SESSION_EVOLVE_REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [playing, selectedId, syncLocked]);

  const currentSound =
    SOUND_LIST.find((s) => s.id === selectedId) || SOUND_LIST[2];

  useEffect(() => {
    if (selectedId !== "s3") {
      setNeuralImmersion(0);
    }
  }, [selectedId]);

  useEffect(() => {
    neuralImmersionRef.current = neuralImmersion;
  }, [neuralImmersion]);

  useEffect(() => {
    const shelf = masterShelfRef.current;
    if (!shelf || !playing) return;
    if (selectedId === "s3") {
      shelf.gain.rampTo(shelfGainDbFor528Osc(oscType), 0.1);
    } else {
      shelf.gain.rampTo(0, 0.08);
    }
  }, [oscType, playing, selectedId]);

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
    if (nativeSound417Ref.current) {
      const graph = nativeSound417Ref.current;
      try {
        graph.baseOsc.stop();
      } catch {
        /* already stopped */
      }
      try {
        graph.noiseSource.stop();
      } catch {
        /* already stopped */
      }
      void graph.context.close();
      nativeSound417Ref.current = null;
    }
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
    // ★追加ここから
    if (lfoRef.current) {
      lfoRef.current.stop();
      lfoRef.current.dispose();
      lfoRef.current = null;
    }
    if (neuralBeatLfoRef.current) {
      neuralBeatLfoRef.current.stop();
      neuralBeatLfoRef.current.dispose();
      neuralBeatLfoRef.current = null;
    }
    // ★追加ここまで
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
    if (neuralPannerLRef.current) {
      neuralPannerLRef.current.dispose();
      neuralPannerLRef.current = null;
    }
    if (neuralPannerRRef.current) {
      neuralPannerRRef.current.dispose();
      neuralPannerRRef.current = null;
    }
    if (reverbRef.current) {
      reverbRef.current.dispose();
      reverbRef.current = null;
    }
    if (masterGainRef.current) {
      masterGainRef.current.dispose();
      masterGainRef.current = null;
    }
    if (masterShelfRef.current) {
      masterShelfRef.current.dispose();
      masterShelfRef.current = null;
    }
    if (masterLpfRef.current) {
      masterLpfRef.current.dispose();
      masterLpfRef.current = null;
    }
    modLfoBuiltForModTypeRef.current = null;
  }, []);

  const stopPlayback = useCallback(() => {
    if (lockSilenceTimerRef.current != null) {
      clearTimeout(lockSilenceTimerRef.current);
      lockSilenceTimerRef.current = null;
    }
    clearTimers();
    disposeSources();
    Tone.Destination.mute = true;
    setPlaying(false);
    setRemainingSec(null);
    setSyncLocked(false);
    setAlignmentBurstAt(null);
    void fetchHistory();
  }, [clearTimers, disposeSources, fetchHistory]);

  const beginFadeOut = useCallback(() => {
    if (nativeSound417Ref.current) {
      const graph = nativeSound417Ref.current;
      stopScheduleRef.current = null;
      const now = graph.context.currentTime;
      graph.masterGain.gain.cancelScheduledValues(now);
      graph.masterGain.gain.setTargetAtTime(0, now, FADE_SECONDS / 3);

      fadeTimerRef.current = setTimeout(() => {
        fadeTimerRef.current = null;
        clearTimers();
        disposeSources();
        setPlaying(false);
        setRemainingSec(null);
        setSyncLocked(false);
        setAlignmentBurstAt(null);
        void fetchHistory();
      }, FADE_SECONDS * 1000 + 120);
      return;
    }

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
      setSyncLocked(false);
      setAlignmentBurstAt(null);
      void fetchHistory();
    }, FADE_SECONDS * 1000 + 120);
  }, [clearTimers, disposeSources, fetchHistory]);

  const startNativeSound417Graph = useCallback(
    async (settings: Sound417Settings, fadeInSec: number) => {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextConstructor) {
        throw new Error("このブラウザでは Web Audio API を利用できません。");
      }

      const context = new AudioContextConstructor();
      await context.resume();

      const baseOsc = context.createOscillator();
      baseOsc.type = "sine";
      baseOsc.frequency.setValueAtTime(417, context.currentTime);

      const baseGain = context.createGain();
      const resonanceFilter = context.createBiquadFilter();
      const dryGain = context.createGain();
      const spatialGain = context.createGain();
      const leftDelay = context.createDelay(0.08);
      const rightDelay = context.createDelay(0.08);
      const merger = context.createChannelMerger(2);
      const textureFilter = context.createBiquadFilter();
      const textureGain = context.createGain();
      const masterGain = context.createGain();

      const noiseSource = context.createBufferSource();
      noiseSource.buffer = createNoiseBuffer(context);
      noiseSource.loop = true;

      baseOsc.connect(baseGain);
      baseGain.connect(resonanceFilter);
      resonanceFilter.connect(dryGain);
      resonanceFilter.connect(leftDelay);
      resonanceFilter.connect(rightDelay);

      leftDelay.connect(merger, 0, 0);
      rightDelay.connect(merger, 0, 1);
      merger.connect(spatialGain);

      dryGain.connect(masterGain);
      spatialGain.connect(masterGain);
      noiseSource.connect(textureFilter);
      textureFilter.connect(textureGain);
      textureGain.connect(masterGain);
      masterGain.connect(context.destination);

      const graph: Sound417NativeGraph = {
        context,
        baseOsc,
        noiseSource,
        baseGain,
        dryGain,
        textureGain,
        spatialGain,
        masterGain,
        resonanceFilter,
        textureFilter,
        leftDelay,
        rightDelay,
        merger,
      };

      applyNativeSound417Settings(graph, settings, 0.01);
      masterGain.gain.setValueAtTime(0, context.currentTime);
      masterGain.gain.linearRampToValueAtTime(
        0.82,
        context.currentTime + Math.max(0.02, fadeInSec),
      );

      baseOsc.start();
      noiseSource.start();
      nativeSound417Ref.current = graph;
    },
    [],
  );

  const startPlayback = useCallback(async (opts?: StartPlaybackOptions) => {
    await Tone.start();
    // 👇 これを追加！フタを開ける（ミュート解除）
    Tone.Destination.mute = false;
    clearTimers();
    disposeSources();

    const sessionSound =
      opts?.soundId != null
        ? (SOUND_LIST.find((s) => s.id === opts.soundId) ?? currentSound)
        : currentSound;
    const sessionMinutes: TimerMinutes =
      opts?.minutesOverride != null &&
      (TIMER_OPTIONS as readonly number[]).includes(opts.minutesOverride)
        ? opts.minutesOverride
        : minutes;

    const durationMs = sessionMinutes * 60 * 1000;
    const waitMs = Math.max(0, durationMs - FADE_SECONDS * 1000);
    const rawFadeIn = opts?.fadeInSec ?? 0;
    const fadeInSec = rawFadeIn > 0.05 ? Math.min(rawFadeIn, 10) : 0;

    if (sessionSound.id === "s2") {
      await startNativeSound417Graph(sound417Settings, fadeInSec);

      const playedAtIso = new Date().toISOString();
      void recordSleepLogAtPlay(
        playedAtIso,
        buildNotesPayload(sessionSound, sessionMinutes),
      );

      endAtRef.current = Date.now() + durationMs;
      setRemainingSec(Math.ceil(durationMs / 1000));
      setPlaying(true);

      stopScheduleRef.current = setTimeout(() => {
        beginFadeOut();
      }, waitMs);
      return;
    }

    const masterLpf = new Tone.Filter({
      type: "lowpass",
      frequency: MASTER_LPF_PRE_HZ,
      rolloff: -24,
    });
    masterLpf.Q.value = 0.78;

    const masterShelf = new Tone.Filter({
      type: "highshelf",
      frequency: 7200,
      Q: 0.65,
      gain: 0,
    });

    const masterGain = new Tone.Gain(MASTER_GAIN_PRE);
    masterLpf.connect(masterShelf);
    masterShelf.connect(masterGain);
    masterGain.toDestination();

    masterLpfRef.current = masterLpf;
    masterShelfRef.current = masterShelf;
    masterGainRef.current = masterGain;

    const t0 = Tone.now();
    masterLpf.frequency.setValueAtTime(MASTER_LPF_POST_HZ, t0);

    if (fadeInSec > 0.05) {
      const tFadeEnd = t0 + fadeInSec;
      masterGain.gain.cancelScheduledValues(t0);
      masterGain.gain.setValueAtTime(0, t0);
      masterGain.gain.linearRampToValueAtTime(MASTER_GAIN_POST, tFadeEnd);
    } else {
      masterGain.gain.setValueAtTime(MASTER_GAIN_POST, t0);
    }

    if (sessionSound.id === "rain") {
      const player = new Tone.Player(sessionSound.audioUrl).connect(masterLpf);
      await Tone.loaded();
      player.start();
      setPlaying(true);
      return;
    }

    const reverb = new Tone.Reverb(REVERB_DECAY_SEC);
    reverb.wet.value = REVERB_WET;
    await reverb.generate();
    reverb.connect(masterLpf);
    reverbRef.current = reverb;

    if (sessionSound.noiseType) {
      if (sessionSound.id === "n5") {
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
      } else if (sessionSound.noiseType === "pink") {
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
        const noise = new Tone.Noise(sessionSound.noiseType).connect(reverb);
        noise.volume.value = -20;
        sourceRef.current = noise;
      }
    } else if (sessionSound.id === "s3") {
      const immersion = Math.min(1, Math.max(0, neuralImmersion));
      const beatHz = neuralInterauralBeatHz(immersion);

      const pannerL = new Tone.Panner(-1).connect(reverb);
      const pannerR = new Tone.Panner(1).connect(reverb);
      neuralPannerLRef.current = pannerL;
      neuralPannerRRef.current = pannerR;

      const oscL = new Tone.Oscillator(NEURAL_SYNC_LEFT_HZ, oscType).connect(
        pannerL,
      );
      const oscR = new Tone.Oscillator(
        NEURAL_SYNC_LEFT_HZ + beatHz,
        oscType,
      ).connect(pannerR);
      oscL.volume.value = -14;
      oscR.volume.value = -14;
      sourceRef.current = oscL;
      secondOscRef.current = oscR;

      if (modType !== "vibrate") {
        const cents = neuralDetuneWobbleCents(immersion);
        const beatLfo = new Tone.LFO({
          frequency: neuralDetuneWobbleHz(immersion),
          min: -cents,
          max: cents,
          type: "sine",
        });
        beatLfo.connect(oscR.detune);
        beatLfo.start();
        neuralBeatLfoRef.current = beatLfo;
      }

      if (modType === "breathe") {
        const lfo = new Tone.LFO({
          frequency: 1 / 13,
          min: -50,
          max: -14,
          type: "sine",
        });
        lfo.connect(oscL.volume);
        lfo.connect(oscR.volume);
        lfo.start();
        lfoRef.current = lfo;
      } else if (modType === "vibrate") {
        const lfo = new Tone.LFO({
          frequency: 4,
          min: -15,
          max: 15,
          type: "sine",
        });
        lfo.connect(oscL.detune);
        lfo.connect(oscR.detune);
        lfo.start();
        lfoRef.current = lfo;
      }
      modLfoBuiltForModTypeRef.current = modType;
    } else if (sessionSound.id === "n6") {
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
    } else if (sessionSound.id === "n7") {
      // 528Hzをベースに、LFOで音量を13秒周期で動かす
      const osc = new Tone.Oscillator(sessionSound.freq!, "sine").connect(reverb);

      const lfo = new Tone.LFO({
        frequency: 1 / 13,
        min: -60, // ほぼ聞こえないレベル
        max: -15, // はっきり聞こえるレベル
        type: "sine",
      }).connect(osc.volume);

      lfo.start();
      sourceRef.current = osc;
      lfoRef.current = lfo;
      // ★追加ここまで
    } else if (sessionSound.id === "n3" || sessionSound.id === "n4") {
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

      const oscL = new Tone.Oscillator(sessionSound.freq!, "sine").connect(
        lowpassL,
      );
      const diff = sessionSound.id === "n3" ? 3 : 6;
      const oscR = new Tone.Oscillator(
        sessionSound.freq! + diff,
        "triangle",
      ).connect(lowpassR);
      oscL.volume.value = -30;
      oscR.volume.value = -30;
      sourceRef.current = oscL;
      secondOscRef.current = oscR;
    } else {
      const f = sessionSound.freq!;
      const osc = new Tone.Oscillator(f, "sine").connect(reverb);
      osc.volume.value = -14;
      const depth = new Tone.Oscillator(
        f + DEPTH_DETUNE_HZ,
        "sine",
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
      buildNotesPayload(sessionSound, sessionMinutes),
    );

    endAtRef.current = Date.now() + durationMs;
    setRemainingSec(Math.ceil(durationMs / 1000));
    setPlaying(true);

    stopScheduleRef.current = setTimeout(() => {
      beginFadeOut();
    }, waitMs);
  }, [
    currentSound,
    minutes,
    beginFadeOut,
    clearTimers,
    disposeSources,
    sound417Settings,
    startNativeSound417Graph,
    neuralImmersion,
    modType,
    oscType,
  ]);

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
    const graph = nativeSound417Ref.current;
    if (!playing || currentSound.id !== "s2" || !graph) return;
    applyNativeSound417Settings(graph, sound417Settings, 0.09);
  }, [sound417Settings, playing, currentSound.id]);

  /** 進化後: Breathe / Vibrate / Off の切替でゆらぎ LFO を作り直す */
  useEffect(() => {
    if (!playing || selectedId !== "s3" || syncLocked) return;
    if (modLfoBuiltForModTypeRef.current === modType) return;

    const oscL = sourceRef.current;
    const oscR = secondOscRef.current;
    if (
      !oscL ||
      !oscR ||
      !(oscL instanceof Tone.Oscillator) ||
      !(oscR instanceof Tone.Oscillator)
    )
      return;

    if (lfoRef.current) {
      try {
        lfoRef.current.stop();
        lfoRef.current.disconnect();
        lfoRef.current.dispose();
      } catch {
        /* disposed */
      }
      lfoRef.current = null;
    }

    const immersion = Math.min(1, Math.max(0, neuralImmersionRef.current));

    if (modType === "none") {
      if (!neuralBeatLfoRef.current && oscR) {
        const cents = neuralDetuneWobbleCents(immersion);
        const beatLfo = new Tone.LFO({
          frequency: neuralDetuneWobbleHz(immersion),
          min: -cents,
          max: cents,
          type: "sine",
        });
        beatLfo.connect(oscR.detune);
        beatLfo.start();
        neuralBeatLfoRef.current = beatLfo;
      }
      modLfoBuiltForModTypeRef.current = modType;
      return;
    }

    if (modType === "breathe") {
      const breathHz = (1 / 13) * (0.55 + 0.85 * immersion);
      const depth = 22 + immersion * 38;
      const lfo = new Tone.LFO({
        frequency: breathHz,
        min: -14 - depth,
        max: -14,
        type: "sine",
      });
      lfo.connect(oscL.volume);
      lfo.connect(oscR.volume);
      lfo.start();
      lfoRef.current = lfo;
    } else if (modType === "vibrate") {
      const vibHz = 2.2 + immersion * 7;
      const d = 10 + immersion * 22;
      const lfo = new Tone.LFO({
        frequency: vibHz,
        min: -d,
        max: d,
        type: "sine",
      });
      lfo.connect(oscL.detune);
      lfo.connect(oscR.detune);
      lfo.start();
      lfoRef.current = lfo;
    }

    if (modType === "vibrate") {
      if (neuralBeatLfoRef.current) {
        neuralBeatLfoRef.current.stop();
        neuralBeatLfoRef.current.dispose();
        neuralBeatLfoRef.current = null;
      }
    } else if (!neuralBeatLfoRef.current) {
      const cents = neuralDetuneWobbleCents(immersion);
      const beatLfo = new Tone.LFO({
        frequency: neuralDetuneWobbleHz(immersion),
        min: -cents,
        max: cents,
        type: "sine",
      });
      beatLfo.connect(oscR.detune);
      beatLfo.start();
      neuralBeatLfoRef.current = beatLfo;
    }

    modLfoBuiltForModTypeRef.current = modType;
  }, [modType, playing, selectedId, syncLocked]);

  /** 進化後: 没入スライダーに追従して Breathe / Vibrate の深さを即反映 */
  useEffect(() => {
    if (!playing || selectedId !== "s3" || syncLocked) return;

    const immersion = Math.min(1, Math.max(0, neuralImmersion));
    const lfo = lfoRef.current;
    if (!lfo) return;

    if (modType === "breathe") {
      const breathHz = (1 / 13) * (0.55 + 0.85 * immersion);
      const depth = 22 + immersion * 38;
      lfo.frequency.rampTo(breathHz, 0.032);
      lfo.min = -14 - depth;
      lfo.max = -14;
    } else if (modType === "vibrate") {
      const vibHz = 2.2 + immersion * 7;
      const d = 10 + immersion * 22;
      lfo.frequency.rampTo(vibHz, 0.032);
      lfo.min = -d;
      lfo.max = d;
    }
  }, [neuralImmersion, modType, playing, selectedId, syncLocked]);

  useEffect(() => {
    if (!playing || currentSound.id !== "s3") return;

    if (modType === "vibrate" && neuralBeatLfoRef.current) {
      neuralBeatLfoRef.current.stop();
      neuralBeatLfoRef.current.dispose();
      neuralBeatLfoRef.current = null;
    }

    const immersion = Math.min(1, Math.max(0, neuralImmersion));
    const beatHz = neuralInterauralBeatHz(immersion);
    const rampF = 0.032;
    secondOscRef.current?.frequency.rampTo(NEURAL_SYNC_LEFT_HZ + beatHz, rampF);

    if (modType === "vibrate") return;

    const oscR = secondOscRef.current;
    if (oscR && !neuralBeatLfoRef.current) {
      const cents = neuralDetuneWobbleCents(immersion);
      const beatLfo = new Tone.LFO({
        frequency: neuralDetuneWobbleHz(immersion),
        min: -cents,
        max: cents,
        type: "sine",
      });
      beatLfo.connect(oscR.detune);
      beatLfo.start();
      neuralBeatLfoRef.current = beatLfo;
    }

    const lfoN = neuralBeatLfoRef.current;
    if (lfoN) {
      const rampW = 0.042;
      lfoN.frequency.rampTo(neuralDetuneWobbleHz(immersion), rampW);
      const c = neuralDetuneWobbleCents(immersion);
      lfoN.min = -c;
      lfoN.max = c;
    }
  }, [
    playing,
    currentSound.id,
    neuralImmersion,
    modType,
  ]);

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

  const snap = playing ? 0.1 : 0.42;

  const pauseSessionModulationForLock = useCallback(() => {
    if (lfoRef.current) {
      lfoRef.current.stop();
      lfoRef.current.dispose();
      lfoRef.current = null;
    }
    modLfoBuiltForModTypeRef.current = null;
    if (neuralBeatLfoRef.current) {
      neuralBeatLfoRef.current.stop();
      neuralBeatLfoRef.current.dispose();
      neuralBeatLfoRef.current = null;
    }

    const voices = [
      sourceRef.current,
      secondOscRef.current,
      thirdOscRef.current,
      depthOscRef.current,
    ].filter((voice): voice is Tone.Oscillator | Tone.Noise => voice != null);

    if (voices.length === 0) return;

    const preserved = voices.map((voice) => ({
      voice,
      level: voice.volume.value,
    }));

    for (const { voice } of preserved) {
      voice.volume.cancelScheduledValues(Tone.now());
      voice.volume.rampTo(-80, 0.04);
    }

    if (lockSilenceTimerRef.current != null) {
      clearTimeout(lockSilenceTimerRef.current);
    }

    lockSilenceTimerRef.current = setTimeout(() => {
      lockSilenceTimerRef.current = null;
      for (const { voice, level } of preserved) {
        const targetLevel =
          currentSound.id === "n6" && voice === thirdOscRef.current
            ? Math.min(level, -34)
            : level;
        voice.volume.rampTo(targetLevel, 0.35);
      }
    }, 120);
  }, [currentSound.id]);

  const toggleSession = useCallback(() => {
    if (playing) {
      setLaunchBurst(false);
      setAlignmentBurstAt(null);
      setSyncLocked(false);
      void stopPlayback();
      return;
    }

    setLaunchBurst(true);
    setAlignmentBurstAt(null);
    setSyncLocked(false);
    void startPlayback();
  }, [playing, startPlayback, stopPlayback]);

  const QUICK_SESSION_FADE_IN_SEC = 3;
  const prevPlayingRef = useRef(false);

  useEffect(() => {
    if (prevPlayingRef.current && !playing) {
      setActiveFrequency(null);
    }
    prevPlayingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (!quickFeedback) return;
    const id = window.setTimeout(() => setQuickFeedback(null), 5000);
    return () => window.clearTimeout(id);
  }, [quickFeedback]);

  const handleQuickMoodPick = useCallback(
    (sel: QuickMoodSelection) => {
      if (playing) return;
      setSelectedId(sel.soundId);
      setMinutes(30);
      setActiveFrequency(sel.hz);
      setQuickFeedback(
        `今のあなたに最適な波形（${sel.hz}Hz）を生成しました。深い没入体験をお楽しみください。`,
      );
      setLaunchBurst(true);
      setAlignmentBurstAt(null);
      setSyncLocked(false);
      void (async () => {
        try {
          await startPlayback({
            fadeInSec: QUICK_SESSION_FADE_IN_SEC,
            soundId: sel.soundId,
            minutesOverride: 30,
          });
        } catch (e) {
          console.error("[QuickMood]", e);
          setQuickFeedback(null);
          setActiveFrequency(null);
          setLaunchBurst(false);
        }
      })();
    },
    [playing, startPlayback],
  );

  useEffect(() => {
    if (!heartSessionPreset) return;
    if (playing) return;

    const rid = heartSessionPreset.requestId;
    if (rid == null || appliedHeartPresetRequestIds.has(rid)) return;
    appliedHeartPresetRequestIds.add(rid);

    const { soundId, frequencyHz, advisoryMessage } = heartSessionPreset;

    void (async () => {
      try {
        setSelectedId(soundId);
        setMinutes(30);
        setActiveFrequency(frequencyHz);
        setQuickFeedback(
          `心拍に基づき ${frequencyHz}Hz を選びました。${advisoryMessage}`,
        );
        setLaunchBurst(true);
        setAlignmentBurstAt(null);
        setSyncLocked(false);
        await startPlayback({
          fadeInSec: QUICK_SESSION_FADE_IN_SEC,
          soundId,
          minutesOverride: 30,
        });
      } catch (e) {
        console.error("[HeartRateSession]", e);
        appliedHeartPresetRequestIds.delete(rid);
        setQuickFeedback(null);
        setActiveFrequency(null);
        setLaunchBurst(false);
      } finally {
        onHeartSessionConsumed?.();
      }
    })();
  }, [heartSessionPreset, playing, startPlayback, onHeartSessionConsumed]);

  const handleSyncLocked = useCallback(() => {
    setAlignmentBurstAt(performance.now());
    setSyncLocked(true);
    pauseSessionModulationForLock();
  }, [pauseSessionModulationForLock]);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("session-focus", playing);
    document.documentElement.classList.toggle("session-lock-focus", syncLocked);
    return () => {
      document.documentElement.classList.remove("session-focus");
      document.documentElement.classList.remove("session-lock-focus");
    };
  }, [playing, syncLocked]);

  useEffect(() => {
    if (!launchBurst) return;

    const timer = window.setTimeout(() => {
      setLaunchBurst(false);
    }, 1100);

    return () => window.clearTimeout(timer);
  }, [launchBurst]);

  useLayoutEffect(() => {
    const el = document.getElementById("quick-mood-root");
    setQuickPortalTarget(el ?? "missing");
  }, []);

  const quickMoodNode = (
    <QuickMoodDiagnosis
      disabled={playing}
      feedback={quickFeedback}
      activeHz={playing ? activeFrequency : null}
      onPick={handleQuickMoodPick}
    />
  );

  return (
    <SessionControlContext.Provider
      value={{ playing, toggleSession, isEvolved }}
    >
      <SessionAmbientField
        active={playing}
        soundId={selectedId}
        alignmentBurstAt={alignmentBurstAt}
        syncLocked={syncLocked}
        immersionRef={neuralImmersionRef}
        evolveAnimStartedAt={evolveAnimStartedAt}
      />
      <EvolveNeuralHeroOverlay
        active={evolveHeroGate}
        value={neuralImmersion}
        onChange={setNeuralImmersion}
      />
      <HiddenSignalLayer
        active={playing}
        soundId={selectedId}
        syncLocked={syncLocked}
      />
      <SyncLockFlash burstAt={alignmentBurstAt} />
      <SessionLaunchBurst active={launchBurst} />
      {quickPortalTarget != null && quickPortalTarget !== "missing"
        ? createPortal(quickMoodNode, quickPortalTarget)
        : null}
      <motion.div
        data-react-session-evolved={isEvolved ? "true" : "false"}
        className={`relative z-10 flex w-full max-w-5xl flex-col items-center gap-4 ${
          isEvolved ? "session-react-evolved" : ""
        }`}
      >
        {quickPortalTarget === "missing" ? (
          <div className="w-full max-w-3xl px-0 sm:px-1">{quickMoodNode}</div>
        ) : null}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          initial={false}
          animate={{
            opacity: syncLocked ? 0.2 : playing ? 0.45 : 1,
            scale: playing ? 0.98 : 1,
          }}
          transition={{ duration: snap, ease: "easeOut" }}
        >
          <AuthNav email={email} />
          <SessionControlButton />
        </motion.div>
        <motion.div
          className={`relative flex h-auto w-full flex-col overflow-hidden rounded-xl border bg-[#0a0a0a] text-slate-200 shadow-2xl md:min-h-[600px] ${
            playing
              ? isEvolved
                ? "border-violet-400/35 duration-150"
                : "border-violet-500/25 duration-700"
              : "border-slate-800 duration-200"
          }`}
        >
      <motion.div
        className="flex min-h-0 flex-1 flex-col md:flex-row"
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: snap, ease: "easeOut" }}
      >
        <aside
          className={`w-full shrink-0 border-b border-slate-800 bg-[#0f0f0f] p-4 transition-all md:border-b-0 md:border-r md:p-6 ${
            syncLocked
              ? "hidden"
              : playing && isEvolved
                  ? "md:w-56 ring-1 ring-violet-500/30"
                  : "md:w-60"
          }`}
        >
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500 md:mb-4">
            Timer
          </h2>
          {playing && isEvolved ? (
            <p className="mb-2 text-[10px] leading-snug text-violet-300/70">
              オフまでの残り時間がカウントされます。分数はタップで変更できます。
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-2 md:flex md:flex-col">
            {TIMER_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={playing}
                onClick={() => setMinutes(m)}
                className={`touch-manipulation rounded-lg px-3 py-2 text-center text-sm transition-[transform,colors,box-shadow] duration-75 will-change-transform active:scale-95 md:text-left ${
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

        <main
          className={`relative z-10 flex min-h-0 min-w-0 flex-1 flex-col ${
            syncLocked ? "p-6 sm:p-10" : "p-4 sm:p-6"
          }`}
        >
        <NeuralScanHud
          active={playing}
          syncLocked={syncLocked}
          onSyncLocked={handleSyncLocked}
        />
        <NeuralSynapseVisualizer
          active={playing}
          soundId={selectedId}
          alignmentBurstAt={alignmentBurstAt}
          syncLocked={syncLocked}
          immersionRef={neuralImmersionRef}
          sound417SettingsRef={sound417SettingsRef}
        />
        <header className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <motion.div
    className={`flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6 ${
      playing ? "hidden" : ""
    }`}
    initial={false}
    animate={{ opacity: playing ? 0 : 1 }}
    transition={{ duration: snap, ease: "easeOut" }}
  >
    <h1 className="shrink-0 text-lg font-bold sm:text-xl">Sound Library</h1>

    {selectedId === "s3" && !playing && (
      <div className="relative flex w-full min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-950/95 via-violet-950/50 to-cyan-950/35 px-4 py-4 shadow-[0_0_48px_-14px_rgba(34,211,238,0.4)] backdrop-blur-md sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-3 sm:px-5 sm:py-3.5">
        <div
          className="pointer-events-none absolute inset-0 z-0 rounded-2xl bg-[radial-gradient(ellipse_at_30%_0%,rgba(167,139,250,0.22),transparent_50%)] opacity-90"
          aria-hidden
        />
        <div
          className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1"
          title={
            neuralImmersion > 0.06
              ? "没入モード中でも音色を変更できます"
              : undefined
          }
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/80">
            音色
          </span>
          <div className="flex gap-2">
            {["sine", "triangle"].map((t) => (
              <label
                key={t}
                className="group flex cursor-pointer items-center gap-1.5"
              >
                <input
                  type="radio"
                  name="oscType"
                  className="h-3 w-3 cursor-pointer accent-cyan-400"
                  checked={oscType === t}
                  onChange={() => setOscType(t as Tone.ToneOscillatorType)}
                />
                <span
                  className={`text-xs ${oscType === t ? "font-bold text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" : "text-slate-400 group-hover:text-slate-200"}`}
                >
                  {t === "sine" ? "Pure" : "Mild"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="relative z-10 hidden h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-cyan-500/35 to-transparent sm:block" />

        <div
          className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1"
          title={
            neuralImmersion > 0.06
              ? "没入モード中でもゆらぎを変更できます"
              : undefined
          }
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200/80">
            ゆらぎ
          </span>
          <div className="flex gap-3">
            {[
              { id: "none", label: "Off" },
              { id: "breathe", label: "Breathe" },
              { id: "vibrate", label: "Vibrate" },
            ].map((m) => (
              <label
                key={m.id}
                className="group flex cursor-pointer items-center gap-1.5"
              >
                <input
                  type="radio"
                  name="modType"
                  className="h-3 w-3 cursor-pointer accent-fuchsia-400"
                  checked={modType === m.id}
                  onChange={() =>
                    setModType(m.id as "none" | "breathe" | "vibrate")
                  }
                />
                <span
                  className={`text-xs ${modType === m.id ? "font-bold text-fuchsia-100 drop-shadow-[0_0_8px_rgba(232,121,249,0.5)]" : "text-slate-400 group-hover:text-slate-200"}`}
                >
                  {m.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="relative z-10 hidden h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-fuchsia-500/30 to-transparent sm:block" />

        <div className="relative z-10 flex min-w-[200px] flex-1 flex-col gap-2 sm:min-w-[260px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="bg-gradient-to-r from-cyan-200 via-violet-200 to-fuchsia-200 bg-clip-text text-[10px] font-bold uppercase tracking-[0.28em] text-transparent">
              Neural synchronizer
            </span>
          </div>
          <p className="text-[11px] leading-snug text-violet-100/55">
            スライダーで意識の深さを潜らせ、脳波同期の密度を感覚的に調整します。
          </p>
          <div className="relative pt-1">
            <NeuralImmersionSlider
              value={neuralImmersion}
              onChange={setNeuralImmersion}
              variant="card"
            />
            <div className="mt-2 flex justify-between text-[10px] font-semibold tracking-[0.12em]">
              <span
                className={
                  neuralImmersion < 0.34
                    ? "text-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.55)]"
                    : "text-slate-500"
                }
              >
                Relax
              </span>
              <span
                className={
                  neuralImmersion >= 0.34 && neuralImmersion < 0.67
                    ? "text-violet-200 drop-shadow-[0_0_10px_rgba(167,139,250,0.5)]"
                    : "text-slate-500"
                }
              >
                Deep
              </span>
              <span
                className={
                  neuralImmersion >= 0.67
                    ? "text-fuchsia-200 drop-shadow-[0_0_10px_rgba(244,114,182,0.45)]"
                    : "text-slate-500"
                }
              >
                Ethereal
              </span>
            </div>
          </div>
        </div>
      </div>
    )}
  </motion.div>

  {playing && remainingSec !== null && (
    <motion.div
      className="shrink-0 text-left sm:text-right"
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: snap }}
    >
      <p className="text-[10px] uppercase tracking-[0.24em] text-violet-300/80">
        Synced Session
      </p>
      <motion.p
        key={remainingSec}
        className="font-mono text-lg tabular-nums text-violet-100"
        initial={{ scale: 1.08, opacity: 0.75 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 560,
          damping: 26,
          mass: 0.22,
        }}
      >
        {formatRemaining(remainingSec)}
      </motion.p>
    </motion.div>
  )}
          </div>

          {playing && selectedId === "s3" && !syncLocked && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: snap, ease: "easeOut" }}
              className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-950/90 via-violet-950/45 to-fuchsia-950/35 px-4 py-3 shadow-[0_0_36px_-10px_rgba(167,139,250,0.45)]"
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.12),transparent_45%)]"
                aria-hidden
              />
              <div className="relative flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                <div className="shrink-0 sm:max-w-[11rem]">
                  <p className="bg-gradient-to-r from-cyan-200 to-fuchsia-200 bg-clip-text text-[10px] font-bold uppercase tracking-[0.3em] text-transparent">
                    Consciousness depth
                  </p>
                  <p className="mt-0.5 text-[11px] text-violet-100/60">
                    没入を続けながら微調整できます
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <NeuralImmersionSlider
                    value={neuralImmersion}
                    onChange={setNeuralImmersion}
                    variant="session"
                  />
                  <div className="mt-1.5 flex justify-between text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span
                      className={
                        neuralImmersion < 0.34 ? "text-cyan-200/90" : ""
                      }
                    >
                      Relax
                    </span>
                    <span
                      className={
                        neuralImmersion >= 0.34 && neuralImmersion < 0.67
                          ? "text-violet-200/90"
                          : ""
                      }
                    >
                      Deep
                    </span>
                    <span
                      className={
                        neuralImmersion >= 0.67 ? "text-fuchsia-200/90" : ""
                      }
                    >
                      Ethereal
                    </span>
                  </div>
                </div>
                {isEvolved && (
                  <div className="w-full border-t border-cyan-500/20 pt-3 sm:order-3 sm:basis-full">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-fuchsia-200/85">
                      ゆらぎ（リアルタイム）
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { id: "none" as const, label: "Off" },
                        { id: "breathe" as const, label: "Breathe" },
                        { id: "vibrate" as const, label: "Vibrate" },
                      ].map((m) => (
                        <label
                          key={m.id}
                          className="group flex cursor-pointer items-center gap-1.5 transition-transform duration-75 active:scale-95"
                        >
                          <input
                            type="radio"
                            name="modTypeSession"
                            className="h-3 w-3 cursor-pointer accent-fuchsia-400"
                            checked={modType === m.id}
                            onChange={() => setModType(m.id)}
                          />
                          <span
                            className={`text-xs ${modType === m.id ? "font-bold text-fuchsia-100" : "text-slate-400 group-hover:text-slate-200"}`}
                          >
                            {m.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </header>
          {playing ? (
            <motion.div
              className={`rounded-2xl border border-violet-500/30 bg-violet-500/10 ${
                selectedId === "s2" ? "session-breath-card" : ""
              } ${
                syncLocked ? "mb-8 px-5 py-5" : "mb-4 px-4 py-3"
              }`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: snap, ease: "easeOut" }}
            >
              <p className="text-[10px] uppercase tracking-[0.24em] text-violet-300/80">
                Resonating
              </p>
              <p className="mt-1 text-lg font-semibold text-white">{currentSound.label}</p>
              <p className="mt-1 text-xs text-slate-400">{currentSound.description}</p>
              {selectedId === "s2" ? (
                <Sound417DetailPanel
                  settings={sound417Settings}
                  onChange={setSound417Settings}
                />
              ) : null}
            </motion.div>
          ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto pb-4 min-[420px]:grid-cols-2">
            {SOUND_LIST.map((s) => {
              const isSelected = selectedId === s.id;
              const is417 = s.id === "s2";

              if (is417) {
                return (
                  <div
                    key={s.id}
                    className={`rounded-lg border transition-[box-shadow,colors] duration-200 ${
                      isSelected
                        ? "border-violet-500 bg-violet-500/5 shadow-[0_0_28px_-8px_rgba(167,139,250,0.55)]"
                        : "border-slate-800 bg-slate-900/30"
                    } ${playing && !isSelected ? "opacity-40" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      disabled={playing}
                      className="touch-manipulation w-full rounded-lg p-3 text-left transition-[transform,colors] duration-100 will-change-transform hover:bg-violet-500/5 active:scale-[0.985] disabled:cursor-not-allowed sm:p-4"
                    >
                      <div className="text-sm font-bold text-white">{s.label}</div>
                      <div className="text-xs text-slate-500">{s.description}</div>
                    </button>
                    {isSelected && !playing ? (
                      <div
                        className="px-3 pb-3 sm:px-4 sm:pb-4"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Sound417DetailPanel
                          settings={sound417Settings}
                          onChange={setSound417Settings}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  disabled={playing}
                  className={`touch-manipulation rounded-lg border p-3 text-left transition-[transform,colors,box-shadow] duration-100 will-change-transform hover:border-slate-600 active:scale-[0.985] disabled:cursor-not-allowed sm:p-4 ${
                    isSelected
                      ? "border-violet-500 bg-violet-500/5"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  } ${playing && !isSelected ? "opacity-40" : ""}`}
                >
                  <div className="text-sm font-bold text-white">{s.label}</div>
                  <div className="text-xs text-slate-500">{s.description}</div>
                </button>
              );
            })}
          </div>
          )}

          {!playing && (
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
                      className="flex flex-col gap-1 rounded-md border border-slate-800/50 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
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
          )}
        </main>
      </motion.div>
        </motion.div>
      </motion.div>
    </SessionControlContext.Provider>
  );
}
