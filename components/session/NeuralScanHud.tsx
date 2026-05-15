"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Props = {
  active: boolean;
  syncLocked: boolean;
  onSyncLocked?: () => void;
  /** 進行前（0〜12秒台）: スライダー等と同様に操作不能スタイルの対象 */
  preSyncGate?: boolean;
};

const FOCUS_STATES = ["LOW", "DRIFTING", "UNSTABLE"] as const;

export function NeuralScanHud({
  active,
  syncLocked,
  onSyncLocked,
  preSyncGate = false,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [noise, setNoise] = useState(78);
  const [focusIndex, setFocusIndex] = useState(0);
  const [syncLabel, setSyncLabel] = useState("INITIALIZING");
  const lockedNotifiedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setNoise(78);
      setFocusIndex(0);
      setSyncLabel("INITIALIZING");
      lockedNotifiedRef.current = false;
      return;
    }

    if (syncLocked) {
      setNoise(12);
      setFocusIndex(0);
      setSyncLabel("LOCKED");
      return;
    }

    const noiseTimer = window.setInterval(() => {
      setNoise(68 + Math.floor(Math.random() * 24));
    }, reduceMotion ? 1800 : 620);

    const focusTimer = window.setInterval(() => {
      setFocusIndex((current) => (current + 1) % FOCUS_STATES.length);
    }, reduceMotion ? 3200 : 1800);

    const syncTimer = window.setTimeout(() => {
      setSyncLabel("SYNCING");
    }, 2200);

    const lockTimer = window.setTimeout(() => {
      setSyncLabel("LOCKED");
    }, 5200);

    return () => {
      window.clearInterval(noiseTimer);
      window.clearInterval(focusTimer);
      window.clearTimeout(syncTimer);
      window.clearTimeout(lockTimer);
    };
  }, [active, reduceMotion, syncLocked]);

  useEffect(() => {
    if (!active || syncLabel !== "LOCKED" || lockedNotifiedRef.current) return;
    lockedNotifiedRef.current = true;
    onSyncLocked?.();
  }, [active, onSyncLocked, syncLabel]);

  return (
    <AnimatePresence>
      {active ? (
        <motion.section
          className={`relative z-20 overflow-hidden rounded-2xl border bg-slate-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md ${
            syncLocked
              ? "mb-8 border-violet-500/10 px-5 py-4"
              : "mb-4 border-violet-500/20 px-4 py-3"
          }`}
          {...(preSyncGate ? { "data-pre-sync-gate": "" } : {})}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/70 to-transparent"
            animate={{ opacity: syncLocked ? 0.45 : [0.35, 0.9, 0.35] }}
            transition={{
              duration: syncLocked ? 0.3 : 5,
              repeat: syncLocked ? 0 : Infinity,
              ease: "easeInOut",
            }}
          />

          {syncLocked ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-violet-200/80">
                Synchronization complete
              </p>
              <p className="font-mono text-sm tracking-[0.18em] text-violet-100">
                SYNC LOCKED
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-200/90">
                SCANNING YOUR CURRENT STATE...
              </p>

              <motion.div
                className="mt-3 grid gap-2 text-xs sm:grid-cols-3"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.12 },
                  },
                }}
              >
                {[
                  { label: "Noise", value: `${noise}%` },
                  { label: "Focus", value: FOCUS_STATES[focusIndex] },
                  { label: "Sync", value: syncLabel },
                ].map((metric) => (
                  <motion.div
                    key={metric.label}
                    className="rounded-xl border border-white/5 bg-black/30 px-3 py-2"
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      {metric.label}
                    </p>
                    <motion.p
                      key={`${metric.label}-${metric.value}`}
                      className="mt-1 font-mono text-sm text-violet-100"
                      initial={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      {metric.value}
                    </motion.p>
                  </motion.div>
                ))}
              </motion.div>
            </>
          )}
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
