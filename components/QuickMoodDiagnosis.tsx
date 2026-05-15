"use client";

import { AnimatePresence, motion } from "framer-motion";

export type QuickMoodSelection = {
  soundId: "s1" | "s2" | "s3" | "s4";
  hz: number;
};

const MOODS: {
  key: string;
  soundId: QuickMoodSelection["soundId"];
  hz: number;
  titleJa: string;
  titleEn: string;
  line: string;
  hoverRing: string;
  hoverShadow: string;
}[] = [
  {
    key: "restore",
    soundId: "s1",
    hz: 396,
    titleJa: "【回復】",
    titleEn: "Restore",
    line: "不安やトラウマからの解放",
    hoverRing: "hover:border-violet-400/55",
    hoverShadow:
      "hover:shadow-[0_0_32px_-6px_rgba(167,139,250,0.65),0_0_48px_-12px_rgba(139,92,246,0.35)]",
  },
  {
    key: "change",
    soundId: "s2",
    hz: 417,
    titleJa: "【変革】",
    titleEn: "Change",
    line: "マイナスな状況からの回復・変化",
    hoverRing: "hover:border-cyan-400/50",
    hoverShadow:
      "hover:shadow-[0_0_32px_-6px_rgba(34,211,238,0.55),0_0_44px_-10px_rgba(6,182,212,0.3)]",
  },
  {
    key: "repair",
    soundId: "s3",
    hz: 528,
    titleJa: "【修復】",
    titleEn: "Repair",
    line: "DNA修復・理想への変換",
    hoverRing: "hover:border-fuchsia-400/50",
    hoverShadow:
      "hover:shadow-[0_0_32px_-6px_rgba(232,121,249,0.55),0_0_44px_-10px_rgba(217,70,239,0.3)]",
  },
  {
    key: "connect",
    soundId: "s4",
    hz: 639,
    titleJa: "【共鳴】",
    titleEn: "Connect",
    line: "人間関係の向上・つながり",
    hoverRing: "hover:border-amber-400/45",
    hoverShadow:
      "hover:shadow-[0_0_32px_-6px_rgba(251,191,36,0.45),0_0_40px_-10px_rgba(245,158,11,0.28)]",
  },
];

type QuickMoodDiagnosisProps = {
  disabled?: boolean;
  onPick: (sel: QuickMoodSelection) => void;
  feedback: string | null;
  /** 再生中に強調する周波数（Hz）— クイック診断の選択と同期 */
  activeHz?: number | null;
};

export function QuickMoodDiagnosis({
  disabled,
  onPick,
  feedback,
  activeHz,
}: QuickMoodDiagnosisProps) {
  return (
    <section
      className="mb-2 w-full rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-4 shadow-lg backdrop-blur-sm sm:mb-3 sm:px-4 sm:py-5"
      aria-label="クイック診断"
    >
      <h2 className="mb-3 text-center text-base font-semibold tracking-wide text-slate-100 sm:text-left">
        今の気分は？
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MOODS.map((m) => {
          const lit = activeHz != null && activeHz === m.hz;
          return (
          <motion.button
            key={m.key}
            type="button"
            disabled={disabled}
            onClick={() => onPick({ soundId: m.soundId, hz: m.hz })}
            whileHover={
              disabled
                ? undefined
                : { scale: 1.02, transition: { duration: 0.18 } }
            }
            whileTap={
              disabled ? undefined : { scale: 0.98, transition: { duration: 0.12 } }
            }
            className={`group relative touch-manipulation overflow-hidden rounded-xl border border-slate-700/75 bg-gradient-to-br from-slate-950/95 to-slate-900/70 px-3 py-3 text-left shadow-md outline-none ring-offset-2 ring-offset-[#0a0a0a] transition-[box-shadow,transform,border-color,opacity] duration-300 focus-visible:ring-2 focus-visible:ring-violet-400/60 disabled:cursor-not-allowed disabled:opacity-45 ${m.hoverRing} ${m.hoverShadow} ${
              lit
                ? "border-violet-300/65 shadow-[0_0_26px_-4px_rgba(196,181,253,0.5)]"
                : ""
            }`}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden
              style={{
                background:
                  "radial-gradient(ellipse 80% 70% at 50% 0%, rgba(167,139,250,0.12), transparent 55%)",
              }}
            />
            <div className="relative z-10 flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                <span className="text-sm font-bold text-white">{m.titleJa}</span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                  {m.titleEn}
                </span>
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-violet-300/90">
                {m.hz} Hz
              </span>
              <p className="text-[11px] leading-snug text-slate-400 group-hover:text-slate-300">
                {m.line}
              </p>
            </div>
          </motion.button>
          );
        })}
      </div>
      <div className="relative mt-3 min-h-[1.5rem]">
        <AnimatePresence mode="wait">
          {feedback ? (
            <motion.p
              key={feedback}
              role="status"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="text-center text-xs leading-relaxed text-violet-200/85 sm:text-left"
            >
              {feedback}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
