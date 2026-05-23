/** ログインIDの正規化 */
export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** ユーザー名形式（英小文字・数字・_） */
export function isUsernameLoginId(loginId: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(loginId);
}

export function isValidLoginId(raw: string): boolean {
  const trimmed = raw.trim();
  if (isEmailLike(trimmed)) {
    return trimmed.length >= 5 && trimmed.length <= 254;
  }
  return isUsernameLoginId(normalizeLoginId(trimmed));
}

/** Supabase Auth 用メール（ユーザー名のときのみ内部ドメイン） */
export function toAuthEmail(username: string): string {
  return `${username}@id.sleep-app.internal`;
}

export type AuthIdentity = {
  authEmail: string;
  profileLoginId: string;
};

/** ログインID → Supabase 用メール & profiles.login_id */
export function resolveAuthIdentity(raw: string): AuthIdentity | null {
  const trimmed = raw.trim();
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
  return "メールアドレス、または 3〜24文字のID（英小文字・数字・_）";
}
