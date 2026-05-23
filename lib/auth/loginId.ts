/** ログインIDの正規化（自動入力の空白・不可視文字を除去） */
export function sanitizeLoginIdInput(raw: string): string {
  return raw
    .trim()
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, "");
}

export function normalizeLoginId(raw: string): string {
  return sanitizeLoginIdInput(raw).toLowerCase();
}

/** ブラウザのメール自動入力を広く受け入れる */
export function isEmailLike(value: string): boolean {
  const v = sanitizeLoginIdInput(value).toLowerCase();
  const at = v.indexOf("@");
  if (at < 1) return false;
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  if (!local || !domain.includes(".")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || domain.length >= 4;
}

export function isUsernameLoginId(loginId: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(loginId);
}

export function isValidLoginId(raw: string): boolean {
  const trimmed = sanitizeLoginIdInput(raw);
  if (isEmailLike(trimmed)) {
    return trimmed.length >= 5 && trimmed.length <= 254;
  }
  return isUsernameLoginId(normalizeLoginId(trimmed));
}

export function toAuthEmail(username: string): string {
  return `${username}@id.sleep-app.internal`;
}

export type AuthIdentity = {
  authEmail: string;
  profileLoginId: string;
};

export function resolveAuthIdentity(raw: string): AuthIdentity | null {
  const trimmed = sanitizeLoginIdInput(raw);
  if (!trimmed) return null;

  if (isEmailLike(trimmed)) {
    const email = trimmed.toLowerCase();
    return { authEmail: email, profileLoginId: email };
  }

  const username = normalizeLoginId(trimmed);
  if (!isUsernameLoginId(username)) return null;

  return {
    authEmail: toAuthEmail(username),
    profileLoginId: username,
  };
}

export function loginIdHint(): string {
  return "メールアドレス推奨（ブラウザのおすすめをそのまま使えます）";
}
