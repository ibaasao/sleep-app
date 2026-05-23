"use client";

import { useEffect, useState } from "react";

type SwState = "idle" | "registered" | "unsupported" | "error";

/**
 * Service Worker 登録（app/layout.tsx からマウント）
 */
export function PwaRegister() {
  const [state, setState] = useState<SwState>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }

    let updateInterval: ReturnType<typeof setInterval> | undefined;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        setState("registered");

        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              /* 新バージョンあり — 次回起動で反映 */
            }
          });
        });

        updateInterval = setInterval(() => {
          void reg.update();
        }, 60 * 60 * 1000);
      } catch {
        setState("error");
      }
    };

    void register();

    return () => {
      if (updateInterval) clearInterval(updateInterval);
    };
  }, []);

  if (process.env.NODE_ENV === "development" && state === "error") {
    return null;
  }

  return null;
}
