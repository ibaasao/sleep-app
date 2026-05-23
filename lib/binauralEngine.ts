import * as Tone from "tone";

const CARRIER_HZ = 150;
const BINAURAL_LPF_HZ = 200;
const REVERB_DECAY_SEC = 6;
const REVERB_WET = 0.4;
const FADE_SEC = 6;
const OSC_VOLUME_DB = -30;

export type BinauralPresetId = "delta" | "theta" | "alpha" | "beta";

export type BinauralPreset = {
  id: BinauralPresetId;
  label: string;
  beatHz: number;
  tagline: string;
  description: string;
  /** 想定される状態 */
  useFor: string;
};

export const BINAURAL_PRESETS: BinauralPreset[] = [
  {
    id: "delta",
    label: "Delta",
    beatHz: 3,
    tagline: "3 Hz · 深い休息",
    description: "左右の耳にわずかに違う周波数を流し、脳が 3 Hz のリズムに同期しやすくなります。",
    useFor: "就寝前・深いリラックス",
  },
  {
    id: "theta",
    label: "Theta",
    beatHz: 6,
    tagline: "6 Hz · 瞑想・入眠",
    description: "穏やかなシータ帯域を目指すビート。思考をゆるめ、呼吸に意識を向けるのに向いています。",
    useFor: "瞑想・仮眠・リセット",
  },
  {
    id: "alpha",
    label: "Alpha",
    beatHz: 10,
    tagline: "10 Hz · 穏やかな覚醒",
    description: "リラックスしながら意識は保ちたいとき向け。ストレス後のクールダウンにも。",
    useFor: "休憩・軽い作業前",
  },
  {
    id: "beta",
    label: "Beta",
    beatHz: 18,
    tagline: "18 Hz · 集中",
    description: "やや高めのビートで覚醒寄り。短時間の集中ブロック向け（長時間は耳休めを）。",
    useFor: "勉強・作業の短時間集中",
  },
];

type Nodes = {
  oscL: Tone.Oscillator;
  oscR: Tone.Oscillator;
  reverb: Tone.Reverb;
  masterGain: Tone.Gain;
};

/**
 * バイナルビート専用の軽量 Tone エンジン（ログイン・DB 不要）
 */
export class BinauralEngine {
  private nodes: Nodes | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  async start(
    presetId: BinauralPresetId,
    options?: { durationMs?: number; onEnd?: () => void },
  ): Promise<void> {
    const preset = BINAURAL_PRESETS.find((p) => p.id === presetId);
    if (!preset) throw new Error(`Unknown preset: ${presetId}`);

    await this.stopImmediate();
    await Tone.start();
    Tone.Destination.mute = false;

    const masterGain = new Tone.Gain(0);
    masterGain.toDestination();

    const reverb = new Tone.Reverb(REVERB_DECAY_SEC);
    reverb.wet.value = REVERB_WET;
    await reverb.generate();
    reverb.connect(masterGain);

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

    const oscL = new Tone.Oscillator(CARRIER_HZ, "sine").connect(lowpassL);
    const oscR = new Tone.Oscillator(
      CARRIER_HZ + preset.beatHz,
      "triangle",
    ).connect(lowpassR);
    oscL.volume.value = OSC_VOLUME_DB;
    oscR.volume.value = OSC_VOLUME_DB;

    const t0 = Tone.now();
    masterGain.gain.setValueAtTime(0, t0);
    masterGain.gain.linearRampToValueAtTime(1, t0 + 1.2);

    oscL.start();
    oscR.start();

    this.nodes = { oscL, oscR, reverb, masterGain };

    if (options?.durationMs && options.durationMs > 0) {
      const waitMs = Math.max(0, options.durationMs - FADE_SEC * 1000);
      this.endTimer = setTimeout(() => {
        void this.fadeOutAndStop().then(() => options.onEnd?.());
      }, waitMs);
    }
  }

  setMasterGain(linear: number): void {
    const g = this.nodes?.masterGain;
    if (!g) return;
    const v = Math.min(1.4, Math.max(0, linear));
    g.gain.rampTo(v, 0.08);
  }

  async fadeOutAndStop(): Promise<void> {
    this.clearTimers();
    const n = this.nodes;
    if (!n) return;

    const t0 = Tone.now();
    n.masterGain.gain.cancelScheduledValues(t0);
    n.masterGain.gain.setValueAtTime(n.masterGain.gain.value, t0);
    n.masterGain.gain.linearRampToValueAtTime(0, t0 + FADE_SEC);

    await new Promise<void>((resolve) => {
      this.fadeTimer = setTimeout(() => {
        void this.stopImmediate().then(resolve);
      }, FADE_SEC * 1000 + 80);
    });
  }

  async stopImmediate(): Promise<void> {
    this.clearTimers();
    const n = this.nodes;
    this.nodes = null;
    if (!n) return;

    try {
      n.oscL.stop();
      n.oscR.stop();
    } catch {
      /* already stopped */
    }
    n.oscL.dispose();
    n.oscR.dispose();
    n.reverb.dispose();
    n.masterGain.dispose();
  }

  isPlaying(): boolean {
    return this.nodes != null;
  }

  /** バックグラウンド復帰時に Web Audio を再開 */
  async resumeContext(): Promise<void> {
    await Tone.start();
    const ctx = Tone.getContext();
    if (ctx.state !== "running") {
      await ctx.resume();
    }
  }

  private clearTimers(): void {
    if (this.endTimer) clearTimeout(this.endTimer);
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    this.endTimer = null;
    this.fadeTimer = null;
  }
}
