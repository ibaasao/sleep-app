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
  if (
    m.includes("email not confirmed") ||
    m.includes("not confirmed")
  ) {
    return "アカウントは未確認です。Supabase で「Confirm email」を OFF にするか、届いた確認メールのリンクを開いてください。その後「ログイン」を試してください。";
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

/** 登録 API → 即ログイン（メール不要） */
async function signUpViaServer(
  loginIdRaw: string,
  password: string,
): Promise<AuthResult | { fallback: true }> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId: loginIdRaw, password }),
  });

  if (res.status === 503) {
    return { fallback: true };
  }

  const json = (await res.json()) as { ok?: boolean; message?: string };
  if (!res.ok || !json.ok) {
    return {
      ok: false,
      message: json.message ?? "登録に失敗しました。",
    };
  }

  return signInWithLoginId(loginIdRaw, password);
}

async function signUpViaClient(
  identity: NonNullable<ReturnType<typeof resolveAuthIdentity>>,
  password: string,
): Promise<AuthResult> {
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
        "登録は完了しました。確認メールは届かない場合があります。上の「ログイン」タブから同じメール・パスワードで入ってください。",
    };
  }

  return {
    ok: false,
    message: mapAuthError(retry.error?.message ?? "登録に失敗しました。"),
  };
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

  const viaServer = await signUpViaServer(loginIdRaw, password);
  if ("fallback" in viaServer) {
    return signUpViaClient(identity, password);
  }
  return viaServer;
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

  await supabase.auth.getSession();
  return { ok: true };
}

/** モバイル Safari 向け: Cookie 反映後に遷移 */
export async function finishAuthAndGoHome(): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.auth.getSession();
  } catch {
    /* ignore */
  }
  window.location.href = "/";
}
