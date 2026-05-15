import { useLayoutEffect } from "react";

/** 進化ヒーロー／アンビエントのブレンド長（ミリ秒） */
export const SESSION_EVOLVE_REVEAL_MS = 500;

const BODY_EVOLVED_CLASS = "is-evolved";
const HTML_DATA_EVOLVED = "data-session-evolved";

export type PlaybackTimeManagerState = {
  /** 再生中は常に true（13秒プリシンクは廃止） */
  isEvolved: boolean;
  /** 互換のため常に null（カウントダウンなし） */
  secondsUntilEvolve: null;
};

/**
 * 再生中は DOM を「進化後」状態に同期する（プリシンク待ちなし）。
 */
export function usePlaybackTimeManager(
  playing: boolean,
): PlaybackTimeManagerState {
  useLayoutEffect(() => {
    if (playing) {
      document.documentElement.setAttribute(HTML_DATA_EVOLVED, "true");
      document.body.classList.add(BODY_EVOLVED_CLASS);
    } else {
      document.documentElement.removeAttribute(HTML_DATA_EVOLVED);
      document.body.classList.remove(BODY_EVOLVED_CLASS);
    }
    return () => {
      document.documentElement.removeAttribute(HTML_DATA_EVOLVED);
      document.body.classList.remove(BODY_EVOLVED_CLASS);
    };
  }, [playing]);

  return { isEvolved: playing, secondsUntilEvolve: null };
}
