/**
 * モバイルで画面オフ・バックグラウンド時も再生セッションを維持するためのユーティリティ。
 *
 * 注意: iOS Safari は OS が Web Audio を停止することがあります。
 * 無音 HTMLAudio ループ + Media Session + Web Locks + 復帰時 resume が現実的な上限です。
 */

/** 極小の無音 WAV（約 0.1 秒） */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

const LOCK_NAME = "sleep-app-audio-session";

export type BackgroundAudioSessionOptions = {
  title?: string;
  artist?: string;
  album?: string;
  /** true のとき Screen Wake Lock を試行（画面消灯を遅らせる。完全な画面オフ維持ではない） */
  requestWakeLock?: boolean;
  /** visibility 復帰時に Tone / Web Audio を再開するコールバック */
  onResumeAudio?: () => void | Promise<void>;
  /** ロック画面の一時停止ボタン */
  onMediaPause?: () => void;
};

type Held = {
  silentAudio: HTMLAudioElement;
  wakeLock: WakeLockSentinel | null;
  lockAbort: AbortController | null;
  lockPromise: Promise<void> | null;
  onResumeAudio?: () => void | Promise<void>;
  visibilityHandler: () => void;
  pageHideHandler: () => void;
  requestWakeLock: boolean;
};

let held: Held | null = null;
let refCount = 0;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function setMediaSession(meta: BackgroundAudioSessionOptions): void {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: meta.title ?? "睡眠サウンド",
      artist: meta.artist ?? "Sleep App",
      album: meta.album ?? "再生中",
    });
    navigator.mediaSession.playbackState = "playing";
    const onPause = meta.onMediaPause;
    if (onPause) {
      try {
        navigator.mediaSession.setActionHandler("pause", onPause);
        navigator.mediaSession.setActionHandler("stop", onPause);
      } catch {
        /* iOS は一部ハンドラ非対応 */
      }
    }
  } catch {
    /* ignore */
  }
}

function clearMediaSession(): void {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = "none";
    navigator.mediaSession.metadata = null;
  } catch {
    /* ignore */
  }
}

async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if (!("wakeLock" in navigator)) return null;
  try {
    return await navigator.wakeLock.request("screen");
  } catch {
    return null;
  }
}

async function startWebLock(signal: AbortSignal): Promise<void> {
  if (!("locks" in navigator)) return;
  try {
    await navigator.locks.request(
      LOCK_NAME,
      { mode: "exclusive", ifAvailable: false },
      async () => {
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    );
  } catch {
    /* ifAvailable 競合など */
  }
}

async function playSilentLoop(audio: HTMLAudioElement): Promise<void> {
  audio.src = SILENT_WAV;
  audio.loop = true;
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.volume = 0.001;
  try {
    await audio.play();
  } catch {
    /* ユーザー操作後に再試行される */
  }
}

async function resumeHeldAudio(): Promise<void> {
  if (!held) return;
  try {
    if (held.silentAudio.paused) {
      await held.silentAudio.play();
    }
  } catch {
    /* ignore */
  }
  try {
    await held.onResumeAudio?.();
  } catch {
    /* ignore */
  }
}

/**
 * バックグラウンド維持セッションを開始（参照カウント付き）
 */
export async function acquireBackgroundAudioSession(
  options: BackgroundAudioSessionOptions = {},
): Promise<void> {
  if (!isBrowser()) return;

  refCount += 1;
  if (held) {
    setMediaSession(options);
    held.onResumeAudio = options.onResumeAudio;
    await resumeHeldAudio();
    return;
  }

  const silentAudio = new Audio();
  silentAudio.setAttribute("playsinline", "true");

  const lockAbort = new AbortController();
  const lockPromise = startWebLock(lockAbort.signal);

  let wakeLock: WakeLockSentinel | null = null;
  if (options.requestWakeLock) {
    wakeLock = await requestWakeLock();
  }

  const requestWakeLockOpt = options.requestWakeLock ?? false;

  const visibilityHandler = () => {
    if (document.visibilityState === "visible") {
      void resumeHeldAudio();
      if (requestWakeLockOpt && !wakeLock && held) {
        void requestWakeLock().then((w) => {
          if (held) held.wakeLock = w;
          wakeLock = w;
        });
      }
    } else if (wakeLock) {
      void wakeLock.release().catch(() => {});
      wakeLock = null;
      if (held) held.wakeLock = null;
    }
  };

  const pageHideHandler = () => {
    void resumeHeldAudio();
  };

  document.addEventListener("visibilitychange", visibilityHandler);
  window.addEventListener("pagehide", pageHideHandler);

  if (wakeLock) {
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  }

  held = {
    silentAudio,
    wakeLock,
    lockAbort,
    lockPromise,
    onResumeAudio: options.onResumeAudio,
    visibilityHandler,
    pageHideHandler,
    requestWakeLock: requestWakeLockOpt,
  };

  setMediaSession(options);
  await playSilentLoop(silentAudio);
}

/**
 * セッションを解放（参照カウントが 0 になったときのみ停止）
 */
export async function releaseBackgroundAudioSession(): Promise<void> {
  if (!isBrowser() || !held) return;

  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;

  const current = held;
  held = null;

  document.removeEventListener("visibilitychange", current.visibilityHandler);
  window.removeEventListener("pagehide", current.pageHideHandler);

  current.lockAbort?.abort();
  void current.lockPromise;

  try {
    current.silentAudio.pause();
    current.silentAudio.removeAttribute("src");
    current.silentAudio.load();
  } catch {
    /* ignore */
  }

  try {
    await current.wakeLock?.release();
  } catch {
    /* ignore */
  }

  clearMediaSession();
}

/** 再生中に Web Audio コンテキストを再開（Tone.start 相当を外から渡す） */
export async function resumeWebAudioContext(
  resumeFn?: () => void | Promise<void>,
): Promise<void> {
  await resumeHeldAudio();
  await resumeFn?.();
}
