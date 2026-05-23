import { createClient } from "@/lib/supabase/client";
import {
  isEmailLike,
  isValidLoginId,
  normalizeLoginId,
  toAuthEmail,
} from "@/lib/auth/loginId";

export type AuthResult =
  | { ok: true }
  | { ok: false; message: string };

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "ログインIDまたはパスワードが正しくありません。";
  }
  if (m.includes("user already registered")) {
    return "このログインIDは既に使われています。ログインしてください。";
  }
  if (m.includes("password")) {
    return "パスワードは6文字以上にしてください。";
  }
  return message;
}

/** 新規登録（ログインID + パスワード） */
export async function signUpWithLoginId(
  loginIdRaw: string,
  password: string,
): Promise<AuthResult> {
  const loginId = normalizeLoginId(loginIdRaw);
  if (!isValidLoginId(loginId)) {
    return {
      ok: false,
      message: "ログインIDは3〜24文字の英小文字・数字・アンダースコア（_）のみ使えます。",
    };
  }
  if (password.length < 6) {
    return { ok: false, message: "パスワードは6文字以上にしてください。" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: toAuthEmail(loginId),
    password,
    options: {
      data: { login_id: loginId },
    },
  });

  if (error) {
    return { ok: false, message: mapAuthError(error.message) };
  }

  if (!data.session) {
    return {
      ok: false,
      message:
        "登録は完了しましたがセッションを開始できませんでした。ログイン画面から入り直してください。",
    };
  }

  await supabase.from("profiles").upsert({ id: data.user!.id, login_id: loginId });

  return { ok: true };
}

/** ログイン（新形式 login_id / 旧形式メールの両方に対応） */
export async function signInWithLoginId(
  loginIdRaw: string,
  password: string,
): Promise<AuthResult> {
  const trimmed = loginIdRaw.trim();
  const loginId = normalizeLoginId(trimmed);
  const supabase = createClient();

  const emailsToTry: string[] = [];
  if (isEmailLike(trimmed)) {
    emailsToTry.push(trimmed.toLowerCase());
  } else if (isValidLoginId(loginId)) {
    emailsToTry.push(toAuthEmail(loginId));
  } else {
    return { ok: false, message: "ログインIDの形式が正しくありません。" };
  }

  let lastError = "ログインIDまたはパスワードが正しくありません。";

  for (const email of emailsToTry) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error && data.session) {
      if (isValidLoginId(loginId) && !isEmailLike(trimmed)) {
        await supabase
          .from("profiles")
          .upsert({ id: data.user.id, login_id: loginId }, { onConflict: "id" });
      }
      return { ok: true };
    }
    if (error) {
      lastError = mapAuthError(error.message);
    }
  }

  return { ok: false, message: lastError };
}
