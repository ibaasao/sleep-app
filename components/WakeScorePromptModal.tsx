"use client";

import { formatDurationJa } from "@/lib/sleepStats";
import { AnimatePresence, motion } from "framer-motion";

const SCORES = [1, 2, 3, 4, 5] as const;

const SCORE_LABELS: Record<(typeof SCORES)[number], string> = {
  1: "だるい",
  2: "少し重い",
  3: "ふつう",
  4: "すっきり",
  5: "最高",
};

type Props = {
  open: boolean;
  soundLabel: string;
  durationSec: number;
  saving?: boolean;
  saveMessage?: string | null;
  onSubmit: (wakeScore: number) => void;
  onSkip: () => void;
};

export function WakeScorePromptModal({
  open,
  soundLabel,
  durationSec,
  saving = false,
  saveMessage = null,
  onSubmit,
  onSkip,
}: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wake-score-title"
        >
          <motion.div
            className="w-full max-w-md rounded-2xl border border-violet-500/30 bg-gradient-to-b from-slate-950 to-[#030712] p-5 shadow-[0_0_48px_-12px_rgba(124,58,237,0.5)] sm:p-6"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300/80">
              session complete
            </p>
            <h2
              id="wake-score-title"
              className="mt-2 text-lg font-semibold text-white"
            >
              今朝の目覚めはどうでしたか？
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              <span className="text-slate-200">{soundLabel}</span>
              {" · "}
              再生 {formatDurationJa(durationSec)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              1〜5で記録すると、マイページの分析とおすすめ周波数に反映されます。
            </p>

            <div className="mt-5 grid grid-cols-5 gap-2">
              {SCORES.map((score) => (
                <button
                  key={score}
                  type="button"
                  disabled={saving}
                  onClick={() => onSubmit(score)}
                  className="touch-manipulation flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-1 py-3 text-center transition hover:border-[#DEFF9A]/40 hover:bg-violet-500/15 disabled:opacity-50"
                >
                  <span className="text-lg font-bold text-[#DEFF9A]">
                    {score}
                  </span>
                  <span className="text-[9px] leading-tight text-slate-500">
                    {SCORE_LABELS[score]}
                  </span>
                </button>
              ))}
            </div>

            {saveMessage ? (
              <p className="mt-3 text-center text-xs text-amber-200/90">
                {saveMessage}
              </p>
            ) : null}

            <button
              type="button"
              disabled={saving}
              onClick={onSkip}
              className="mt-4 w-full rounded-xl border border-slate-600/80 py-2.5 text-xs text-slate-400 transition hover:bg-slate-800/60 disabled:opacity-50"
            >
              あとで記録する（スキップ）
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
