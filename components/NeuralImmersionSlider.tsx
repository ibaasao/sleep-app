"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";

export type NeuralImmersionSliderProps = {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  /** card = 設定パネル内 / session = 再生中バー */
  variant?: "card" | "session";
};

type TrailDot = {
  id: number;
  xPct: number;
  yJitter: number;
  driftX: number;
  driftY: number;
};

const INPUT_CARD =
  "relative z-20 h-3 w-full cursor-pointer appearance-none rounded-full bg-transparent disabled:cursor-not-allowed disabled:opacity-40 " +
  "[&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-0 " +
  "[&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing " +
  "[&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-amber-100 [&::-webkit-slider-thumb]:via-cyan-100 [&::-webkit-slider-thumb]:to-fuchsia-200 " +
  "[&::-webkit-slider-thumb]:[clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)] " +
  "[&::-webkit-slider-thumb]:shadow-[0_0_6px_#fff,0_0_16px_rgba(34,211,238,1),0_0_28px_rgba(167,139,250,0.85)] " +
  "[&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:border-0 " +
  "[&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-amber-100 [&::-moz-range-thumb]:via-cyan-100 [&::-moz-range-thumb]:to-fuchsia-200 " +
  "[&::-moz-range-thumb]:[clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)] " +
  "[&::-moz-range-thumb]:shadow-[0_0_6px_#fff,0_0_16px_rgba(34,211,238,1),0_0_28px_rgba(167,139,250,0.85)]";

const INPUT_SESSION =
  "relative z-20 h-3 w-full cursor-pointer appearance-none rounded-full bg-transparent disabled:cursor-not-allowed disabled:opacity-40 " +
  "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-0 " +
  "[&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing " +
  "[&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-amber-100 [&::-webkit-slider-thumb]:via-cyan-100 [&::-webkit-slider-thumb]:to-fuchsia-200 " +
  "[&::-webkit-slider-thumb]:[clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)] " +
  "[&::-webkit-slider-thumb]:shadow-[0_0_4px_#fff,0_0_14px_rgba(34,211,238,0.95),0_0_22px_rgba(232,121,249,0.75)] " +
  "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:border-0 " +
  "[&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-amber-100 [&::-moz-range-thumb]:via-cyan-100 [&::-moz-range-thumb]:to-fuchsia-200 " +
  "[&::-moz-range-thumb]:[clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)] " +
  "[&::-moz-range-thumb]:shadow-[0_0_4px_#fff,0_0_14px_rgba(34,211,238,0.95),0_0_22px_rgba(232,121,249,0.75)]";

export function NeuralImmersionSlider({
  value,
  onChange,
  disabled = false,
  variant = "card",
}: NeuralImmersionSliderProps) {
  const trailIdRef = useRef(0);
  const lastXPctRef = useRef<number | null>(null);
  const [trails, setTrails] = useState<TrailDot[]>([]);

  const pushTrailSegment = useCallback((from: number, to: number) => {
    const dist = Math.abs(to - from);
    const steps = Math.min(16, Math.max(1, Math.ceil(dist / 3.5)));
    const batch: TrailDot[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = steps === 0 ? 0 : i / steps;
      batch.push({
        id: trailIdRef.current++,
        xPct: from + (to - from) * t,
        yJitter: (Math.random() - 0.5) * 12,
        driftX: (Math.random() - 0.5) * 16,
        driftY: 10 + Math.random() * 14,
      });
    }
    setTrails((prev) => [...prev, ...batch].slice(-48));
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Number(e.target.value);
    const next = Math.min(1, Math.max(0, raw / 1000));
    const xPct = next * 100;
    if (lastXPctRef.current !== null) {
      pushTrailSegment(lastXPctRef.current, xPct);
    } else {
      pushTrailSegment(xPct, xPct);
    }
    lastXPctRef.current = xPct;
    onChange(next);
  };

  const handlePointerDown = () => {
    lastXPctRef.current = value * 100;
  };

  const handlePointerUp = () => {
    lastXPctRef.current = null;
  };

  const pct = Math.round(value * 100);
  const glow = value;
  const isSession = variant === "session";

  const syncGlowLayers = [
    `0 0 ${8 + glow * 36}px rgba(34, 211, 238, ${0.15 + glow * 0.55})`,
    `0 0 ${14 + glow * 52}px rgba(167, 139, 250, ${0.12 + glow * 0.5})`,
    `0 0 ${22 + glow * 70}px rgba(244, 114, 182, ${glow * 0.45})`,
    `0 0 ${3 + glow * 10}px rgba(254, 249, 195, ${glow * 0.35})`,
  ].join(", ");

  const trackGradient =
    variant === "session"
      ? `linear-gradient(90deg, rgba(34,211,238,0.45) 0%, rgba(167,139,250,0.55) ${value * 50}%, rgba(244,114,182,0.5) ${value * 100}%, rgba(15,23,42,0.2) ${value * 100}%, rgba(15,23,42,0.2) 100%)`
      : `linear-gradient(90deg, rgba(34,211,238,0.55) 0%, rgba(167,139,250,0.65) ${value * 50}%, rgba(244,114,182,0.45) ${value * 100}%, rgba(15,23,42,0.25) ${value * 100}%, rgba(15,23,42,0.25) 100%)`;

  const inputClass = variant === "session" ? INPUT_SESSION : INPUT_CARD;

  return (
    <div
      className={`relative ${isSession ? "min-h-[2.75rem]" : "min-h-[3.25rem]"} flex flex-col justify-center`}
    >
      <div className="relative h-10 w-full shrink-0">
        <span
          className={`pointer-events-none absolute inset-0 flex items-center justify-center font-black tabular-nums tracking-tight text-white select-none ${
            isSession ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"
          }`}
          style={{
            opacity: 0.05 + value * 0.11,
            textShadow: syncGlowLayers,
            color: `rgba(226, 232, 255, ${0.12 + value * 0.28})`,
          }}
          aria-hidden
        >
          {pct}%
        </span>

        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-[5] h-10 -translate-y-1/2 overflow-visible"
          aria-hidden
        >
          <AnimatePresence initial={false}>
            {trails.map((p) => (
              <motion.span
                key={p.id}
                className="absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-100 via-white to-fuchsia-200 shadow-[0_0_10px_rgba(255,255,255,0.9)]"
                style={{
                  left: `${p.xPct}%`,
                  marginTop: p.yJitter,
                }}
                initial={{ opacity: 0.95, scale: 1.2 }}
                animate={{
                  opacity: 0,
                  scale: 0.15,
                  y: p.driftY,
                  x: p.driftX,
                }}
                transition={{ duration: 0.48, ease: "easeOut" }}
                onAnimationComplete={() =>
                  setTrails((prev) => prev.filter((t) => t.id !== p.id))
                }
              />
            ))}
          </AnimatePresence>
        </div>

        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 h-2 -translate-y-1/2 rounded-full bg-slate-950/85"
          aria-hidden
        />

        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          disabled={disabled}
          value={Math.round(value * 1000)}
          onChange={handleInput}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={inputClass}
          style={{ background: trackGradient }}
          aria-label="Neural synchronizer depth"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`シンクロ率 ${pct}パーセント`}
        />
      </div>
    </div>
  );
}
