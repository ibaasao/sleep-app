"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { LOCK_FLASH_MS } from "@/components/session/syncLockMotion";

type Props = {
  burstAt: number | null;
};

export function SyncLockFlash({ burstAt }: Props) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (burstAt == null) return;

    setActive(true);
    const timer = window.setTimeout(() => {
      setActive(false);
    }, LOCK_FLASH_MS);

    return () => window.clearTimeout(timer);
  }, [burstAt]);

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key={burstAt}
          className="pointer-events-none fixed inset-0 z-[80]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.92, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: LOCK_FLASH_MS / 1000, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-100/90 via-fuchsia-100/70 to-violet-200/80" />
          <motion.div
            className="absolute inset-0 bg-white/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            transition={{ duration: LOCK_FLASH_MS / 1000, ease: "easeOut" }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
