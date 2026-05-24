import { resolveAuthIdentity, sanitizeLoginIdInput } from "@/lib/auth/loginId";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * 新規登録（メール確認なし・即利用）
 * SUPABASE_SERVICE_ROLE_KEY が Vercel に必要
 */
export async function POST(request: Request) {
  let body: { loginId?: string; password?: string };
  try {
    body = (await request.json()) as { loginId?: string; password?: string };
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエストが不正です。" },
      { status: 400 },
    );
  }

  const loginIdRaw = body.loginId ?? "";
  const password = body.password ?? "";
  const identity = resolveAuthIdentity(sanitizeLoginIdInput(loginIdRaw));

  if (!identity) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "メールアドレスの形式を確認してください。IDだけ使う場合は英小文字・数字・_ の3〜24文字です。",
      },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, message: "パスワードは6文字以上にしてください。" },
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, fallback: true, message: "server_config" },
      { status: 503 },
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email: identity.authEmail,
    password,
    email_confirm: true,
    user_metadata: { login_id: identity.profileLoginId },
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("already") || m.includes("registered")) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "このアカウントは既に登録されています。「ログイン」タブから入ってください。",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  const userId = data.user?.id;
  if (userId) {
    await admin.from("profiles").upsert({
      id: userId,
      login_id: identity.profileLoginId,
    });
  }

  return NextResponse.json({ ok: true });
}
