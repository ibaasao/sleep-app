"use client";

import {
  acquireBackgroundAudioSession,
  releaseBackgroundAudioSession,
  type BackgroundAudioSessionOptions,
} from "@/lib/backgroundAudioSession";
import { useEffect, useRef } from "react";

/**
 * 再生中のみバックグラウンド維持（無音ループ・Web Locks・Wake Lock・Media Session）
 */
export function useBackgroundAudioSession(
  active: boolean,
  options: BackgroundAudioSessionOptions,
): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!active) {
      void releaseBackgroundAudioSession();
      return;
    }

    void acquireBackgroundAudioSession({
      ...optionsRef.current,
      onResumeAudio: async () => {
        await optionsRef.current.onResumeAudio?.();
      },
    });

    return () => {
      void releaseBackgroundAudioSession();
    };
  }, [active, options.title, options.artist, options.requestWakeLock]);
}
