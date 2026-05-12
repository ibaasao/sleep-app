"use client";

import { AnimatePresence, motion } from "framer-motion";

type Props = {
  active: boolean;
  onComplete?: () => void;
};

export function SessionLaunchBurst({ active, onComplete }: Props) {
  return (
    <AnimatePresence onExitComplete={onComplete}>
      {active ? (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="absolute inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.82, 0] }}
            transition={{ duration: 0.2, times: [0, 0.45, 1], ease: "easeOut" }}
          />

          <motion.div
            className="absolute h-[42vmin] w-[42vmin] rounded-full bg-violet-700/20 blur-3xl"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 2.8, 3.4], opacity: [0, 0.45, 0] }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />

          {[0, 1, 2].map((index) => (
            <motion.div
              key={`ripple-${index}`}
              className="absolute rounded-full border border-violet-300/20 bg-violet-500/5"
              style={{ width: "18vmin", height: "18vmin" }}
              initial={{ scale: 0.35, opacity: 0 }}
              animate={{ scale: [0.35, 2.6, 3.2], opacity: [0, 0.35, 0] }}
              transition={{
                duration: 1.15,
                delay: index * 0.08,
                ease: "easeOut",
              }}
            />
          ))}

          {[0, 1, 2].map((index) => (
            <motion.div
              key={`ring-${index}`}
              className="absolute rounded-full border border-violet-400/70 shadow-[0_0_24px_rgba(139,92,246,0.35)]"
              style={{ width: 120 + index * 28, height: 120 + index * 28 }}
              initial={{ scale: 0.3, opacity: 0.85 }}
              animate={{ scale: 4.2, opacity: 0 }}
              transition={{
                duration: 1.05,
                delay: index * 0.12,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
