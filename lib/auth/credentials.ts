import { getAuthCallbackUrl } from "@/lib/authRedirect";
import { createClient } from "@/lib/supabase/client";
import { resolveAuthIdentity, sanitizeLoginIdInput } from "@/lib/auth/loginId";

export type AuthResult =
  | { ok: true }
  | { ok: false; message: string };

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "ログインIDまたはパスワードが正しくありません。";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "このログインIDは既に登録されています。「ログイン」タブから入ってください。";
  }
  if (m.includes("password")) {
    return "パスワードは6文字以上にしてください。";
  }
  if (m.includes("rate limit")) {
    return "しばらく待ってから再度お試しください。";
  }
  return message;
}

async function upsertProfile(userId: string, loginId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, login_id: loginId }, { onConflict: "id" });
  if (error) {
    console.warn("[auth] profiles upsert:", error.message);
  }
}

/** 新規登録（ログインID + パスワード） */
export async function signUpWithLoginId(
  loginIdRaw: string,
  password: string,
): Promise<AuthResult> {
  const identity = resolveAuthIdentity(sanitizeLoginIdInput(loginIdRaw));
  if (!identity) {
    return {
      ok: false,
      message:
        "メールアドレスの形式を確認してください。IDだけ使う場合は英小文字・数字・_ の3〜24文字です。",
    };
  }
  if (password.length < 6) {
    return { ok: false, message: "パスワードは6文字以上にしてください。" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: identity.authEmail,
    password,
    options: {
      data: { login_id: identity.profileLoginId },
      emailRedirectTo: getAuthCallbackUrl(),
    },
  });

  if (error) {
    return { ok: false, message: mapAuthError(error.message) };
  }

  if (data.session && data.user) {
    await upsertProfile(data.user.id, identity.profileLoginId);
    return { ok: true };
  }

  // メール確認 OFF でも環境によって session が無いことがある → 即ログインを試す
  const retry = await supabase.auth.signInWithPassword({
    email: identity.authEmail,
    password,
  });

  if (retry.data.session && retry.data.user) {
    await upsertProfile(retry.data.user.id, identity.profileLoginId);
    return { ok: true };
  }

  if (data.user) {
    return {
      ok: false,
      message:
        "登録は完了しました。確認メールが届いている場合はリンクを開いてからログインしてください。届かない・すぐ使いたい場合は Supabase の「Confirm email」を OFF にしてください。",
    };
  }

  return {
    ok: false,
    message: mapAuthError(retry.error?.message ?? "登録に失敗しました。"),
  };
}

/** ログイン */
export async function signInWithLoginId(
  loginIdRaw: string,
  password: string,
): Promise<AuthResult> {
  const identity = resolveAuthIdentity(sanitizeLoginIdInput(loginIdRaw));
  if (!identity) {
    return {
      ok: false,
      message: "メールアドレスまたはログインIDを確認してください。",
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: identity.authEmail,
    password,
  });

  if (error || !data.session) {
    return {
      ok: false,
      message: mapAuthError(error?.message ?? "ログインに失敗しました。"),
    };
  }

  await upsertProfile(data.user.id, identity.profileLoginId);
  return { ok: true };
}
