import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  loginId: string;
};

/** サーバー: ログイン中ユーザーの ID と表示用 login_id */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("login_id")
      .eq("id", user.id)
      .maybeSingle();

    const metaLoginId =
      typeof user.user_metadata?.login_id === "string"
        ? user.user_metadata.login_id
        : null;

    const loginId =
      profile?.login_id ??
      metaLoginId ??
      user.email?.split("@")[0] ??
      "user";

    return { id: user.id, loginId };
  } catch {
    return null;
  }
}
