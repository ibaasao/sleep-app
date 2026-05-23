/** ログインIDの正規化（英小文字・数字・アンダースコア） */
export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidLoginId(loginId: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(loginId);
}

/** Supabase Auth 用の内部メール（login_id と 1:1） */
export function toAuthEmail(loginId: string): string {
  return `${loginId}@id.sleep-app.internal`;
}

/** レガシー: 以前メールアドレスで登録したユーザー向け */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function loginIdHint(): string {
  return "3〜24文字（英小文字・数字・_）";
}
