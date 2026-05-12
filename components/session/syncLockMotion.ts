export const LOCK_FLASH_MS = 100;
export const LOCK_PULL_MS = 720;

export function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

export function getLockPullStrength(
  burstAt: number | null,
  now: number,
  locked: boolean,
): number {
  if (burstAt == null) {
    return locked ? 1 : 0;
  }

  const elapsed = now - burstAt;
  if (elapsed <= LOCK_PULL_MS) {
    return easeOutCubic(elapsed / LOCK_PULL_MS);
  }

  return locked ? 1 : Math.max(0, 1 - (elapsed - LOCK_PULL_MS) / 700);
}
