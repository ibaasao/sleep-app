"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import { getSessionTheme, rgba } from "@/components/session/sessionTheme";

type Props = {
  active: boolean;
  soundId: string;
  syncLocked: boolean;
};

const LOCK_PHRASES = [
  { text: "NOTICE THE PATTERN", top: "24%", left: "12%" },
  { text: "YOU ARE NOW SYNCHRONIZED", top: "58%", left: "18%" },
] as const;

const REVEAL_DURATION_MS = 2200;

export function HiddenSignalLayer({ active, soundId, syncLocked }: Props) {
  const reduceMotion = useReducedMotion();
  const [clarity, setClarity] = useState(0);
  const theme = getSessionTheme(soundId);

  useEffect(() => {
    if (!active) {
      setClarity(0);
      return;
    }

    if (!syncLocked) {
      setClarity(0);
      return;
    }

    if (reduceMotion) {
      setClarity(1);
      return;
    }

    const startedAt = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / REVEAL_DURATION_MS);
      setClarity(progress);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [active, reduceMotion, syncLocked]);

  const blur = syncLocked ? Math.max(0, 12 - clarity * 12) : 14;
  const opacity = syncLocked ? 0.08 + clarity * 0.24 : 0.05;
  const noiseOpacity = syncLocked ? Math.max(0, 0.45 - clarity * 0.45) : 0.55;

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key={`hidden-signal-${soundId}`}
          className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {LOCK_PHRASES.map((phrase, index) => (
            <motion.p
              key={phrase.text}
              className="absolute max-w-[18rem] font-mono text-[10px] uppercase tracking-[0.35em] sm:text-xs"
              style={{
                top: phrase.top,
                left: phrase.left,
                color: rgba(theme.accentRgb, opacity),
                textShadow: `0 0 22px ${rgba(theme.primaryRgb, opacity * 0.85)}`,
                filter: `blur(${blur}px)`,
              }}
              animate={{
                opacity: syncLocked
                  ? [opacity * 0.75, opacity, opacity * 0.88]
                  : opacity * 0.55,
                y: syncLocked ? [0, -2, 0] : 0,
              }}
              transition={{
                duration: 7 + index,
                repeat: syncLocked ? Infinity : 0,
                ease: "easeInOut",
              }}
            >
              {phrase.text}
            </motion.p>
          ))}

          <motion.div
            className="absolute inset-0 mix-blend-screen"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)",
              opacity: noiseOpacity,
            }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
