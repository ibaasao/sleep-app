/**
 * 認証リダイレクト用のサイト URL（メールリンク・コールバックで origin を揃える）
 */
export function getAuthCallbackUrl(request?: Request): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }

  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) {
    return `${fromEnv}/auth/callback`;
  }

  if (request) {
    const url = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto =
      request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}/auth/callback`;
    }
    return `${url.origin}/auth/callback`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/auth/callback`;
  }

  return "http://localhost:3000/auth/callback";
}

/** ログイン後の遷移先（相対パスのみ許可） */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}
