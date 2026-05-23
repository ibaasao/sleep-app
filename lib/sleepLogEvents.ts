export const SLEEP_LOG_UPDATED_EVENT = "sleep-log-updated";

export function notifySleepLogUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SLEEP_LOG_UPDATED_EVENT));
  }
}
