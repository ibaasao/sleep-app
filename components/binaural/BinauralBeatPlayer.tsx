"use client";

import {
  BINAURAL_PRESETS,
  BinauralEngine,
  type BinauralPresetId,
} from "@/lib/binauralEngine";
import { useBackgroundAudioSession } from "@/hooks/useBackgroundAudioSession";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const ACCENT = "#7dd3fc";
const TIMER_OPTIONS = [0, 5, 10, 15, 30, 60] as const;

export function BinauralBeatPlayer() {
  const engineRef = useRef<BinauralEngine | null>(null);
  const [presetId, setPresetId] = useState<BinauralPresetId>("theta");
  const [minutes, setMinutes] = useState<(typeof TIMER_OPTIONS)[number]>(15);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preset =
    BINAURAL_PRESETS.find((p) => p.id === presetId) ?? BINAURAL_PRESETS[1];

  useEffect(() => {
    engineRef.current = new BinauralEngine();
    return () => {
      void engineRef.current?.stopImmediate();
    };
  }, []);

  useEffect(() => {
    if (!playing || minutes === 0) {
      setRemainingSec(null);
      return;
    }
    const endAt = Date.now() + minutes * 60 * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) setPlaying(false);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [playing, minutes]);

  useEffect(() => {
    engineRef.current?.setMasterGain(volume);
  }, [volume, playing]);

  const togglePlay = useCallback(async () => {
    setError(null);
    const engine = engineRef.current;
    if (!engine) return;

    if (playing) {
      await engine.fadeOutAndStop();
      setPlaying(false);
      setRemainingSec(null);
      return;
    }

    try {
      await engine.start(presetId, {
        durationMs: minutes > 0 ? minutes * 60 * 1000 : undefined,
        onEnd: () => {
          setPlaying(false);
          setRemainingSec(null);
        },
      });
      engine.setMasterGain(volume);
      setPlaying(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "再生を開始できませんでした。画面をタップしてから再度お試しください。",
      );
    }
  }, [playing, presetId, minutes, volume]);

  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  useBackgroundAudioSession(playing, {
    title: `${preset.label} · ${preset.beatHz} Hz`,
    artist: "Binaural Beats",
    album: preset.useFor,
    requestWakeLock: false,
    onResumeAudio: async () => {
      await engineRef.current?.resumeContext();
    },
    onMediaPause: () => {
      if (playing) void togglePlayRef.current();
    },
  });

  const formatRemaining = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-10 sm:py-14">
      <header className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-300/70">
          Free · No login
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Binaural Beats
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          ヘッドフォン推奨。左右でわずかに違う音を聴くことで、脳波のリズムを誘導します。
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-xs text-violet-300/90 underline-offset-2 hover:text-violet-200 hover:underline"
        >
          ← 睡眠サウンド（メイン）へ
        </Link>
      </header>

      <section className="rounded-2xl border border-cyan-500/20 bg-slate-950/80 p-4 sm:p-5">
        <p className="text-xs font-medium text-slate-500">ビートの種類</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {BINAURAL_PRESETS.map((p) => {
            const selected = presetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={playing}
                onClick={() => setPresetId(p.id)}
                className={`rounded-xl border px-3 py-3 text-left transition disabled:opacity-50 ${
                  selected
                    ? "border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_24px_-8px_rgba(34,211,238,0.45)]"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-600"
                }`}
              >
                <span className="text-sm font-bold text-white">{p.label}</span>
                <span className="mt-0.5 block text-[10px] text-cyan-200/70">
                  {p.tagline}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 rounded-xl bg-black/30 px-4 py-3">
          <p className="text-sm font-medium text-white">{preset.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {preset.description}
          </p>
          <p className="mt-2 text-[11px] text-cyan-200/60">
            向いている場面: {preset.useFor}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
        <p className="text-xs font-medium text-slate-500">タイマー</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TIMER_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              disabled={playing}
              onClick={() => setMinutes(m)}
              className={`rounded-lg px-3 py-2 text-sm transition disabled:opacity-50 ${
                minutes === m
                  ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/40"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              {m === 0 ? "無制限" : `${m}分`}
            </button>
          ))}
        </div>
        <label className="mt-5 block">
          <span className="text-xs text-slate-500">音量</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="mt-2 w-full accent-cyan-400"
          />
        </label>
      </section>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          className="w-full max-w-xs rounded-2xl px-8 py-4 text-base font-semibold text-slate-950 transition active:scale-[0.98]"
          style={{
            background: playing
              ? "linear-gradient(135deg, #f87171, #fb923c)"
              : `linear-gradient(135deg, ${ACCENT}, #a78bfa)`,
          }}
        >
          {playing ? "停止（フェードアウト）" : "再生を開始"}
        </button>
        {playing && remainingSec != null && minutes > 0 ? (
          <p className="text-sm tabular-nums text-cyan-200/80">
            残り {formatRemaining(remainingSec)}
          </p>
        ) : playing && minutes === 0 ? (
          <p className="text-xs text-slate-500">無制限再生中</p>
        ) : null}
        {error ? (
          <p className="text-center text-xs text-rose-300/90">{error}</p>
        ) : null}
        <p className="max-w-sm text-center text-[11px] leading-relaxed text-slate-500">
          初回はブラウザの音声許可が必要です。体調が悪いときや運転中は使用しないでください。
        </p>
      </div>
    </div>
  );
}
