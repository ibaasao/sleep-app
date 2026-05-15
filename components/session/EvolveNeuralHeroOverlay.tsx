"use client";

import { motion } from "framer-motion";
import { SESSION_EVOLVE_REVEAL_MS } from "@/hooks/usePlaybackTimeManager";
import { NeuralImmersionSlider } from "@/components/NeuralImmersionSlider";

const revealSec = SESSION_EVOLVE_REVEAL_MS / 1000;

type Props = {
  active: boolean;
  value: number;
  onChange: (next: number) => void;
};

/**
 * `is-evolved` 成立直後: Neural synchronizer を画面中央に大きくフェードイン（0.5s）
 */
export function EvolveNeuralHeroOverlay({ active, value, onChange }: Props) {
  if (!active) return null;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[40] flex items-center justify-center px-5 py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: revealSec, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="w-full max-w-[min(36rem,calc(100vw-2rem))]"
        initial={{ opacity: 0, scale: 0.82, y: 12 }}
        animate={{ opacity: 1, scale: 1.08, y: 0 }}
        transition={{ duration: revealSec, ease: [0.22, 1, 0.36, 1] }}
        style={{
          filter:
            "drop-shadow(0 0 14px rgba(34,211,238,0.95)) drop-shadow(0 0 28px rgba(167,139,250,0.75)) drop-shadow(0 0 42px rgba(244,114,182,0.5)) drop-shadow(0 0 4px rgba(254,249,195,0.35))",
        }}
      >
        <div className="rounded-3xl border border-cyan-400/25 bg-slate-950/82 px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md sm:px-10 sm:py-9">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.38em] text-cyan-200/90">
            Neural synchronizer
          </p>
          <p className="mt-2 text-center text-xs text-violet-100/65">
            意識の深さ — 同期密度
          </p>
          <div className="mt-6">
            <NeuralImmersionSlider
              variant="evolveHero"
              value={value}
              onChange={onChange}
              disabled
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
