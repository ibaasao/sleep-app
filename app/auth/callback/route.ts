import { safeNextPath } from "@/lib/authRedirect";
import type { CookieToSet } from "@/lib/supabase/cookieTypes";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase のメール確認・リダイレクト用（404 防止）
 * セッション Cookie は redirect レスポンスに載せる
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  const redirectOk = () => {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto");
    if (forwardedHost && forwardedProto) {
      return NextResponse.redirect(
        `${forwardedProto}://${forwardedHost}${next}`,
      );
    }
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  };

  const redirectLogin = (reason: string) =>
    NextResponse.redirect(
      new URL(
        `/login?error=auth&reason=${encodeURIComponent(reason)}`,
        requestUrl.origin,
      ),
    );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return redirectLogin("config");
  }

  if (!code && !(tokenHash && type)) {
    return redirectLogin("missing_code");
  }

  const response = redirectOk();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession", error.message);
      return redirectLogin("exchange");
    }
    return response;
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "email" | "magiclink" | "signup" | "invite" | "recovery",
    });
    if (error) {
      console.error("[auth/callback] verifyOtp", error.message);
      return redirectLogin("verify");
    }
    return response;
  }

  return redirectLogin("unknown");
}
