import { createClient } from "@/lib/supabase/client";

export type SaveSleepLogSuccess = {
  ok: true;
  id: string;
};

export type SaveSleepLogFailure = {
  ok: false;
  /** 未ログインなど、保存をスキップした場合 */
  warning?: string;
  /** Supabase やセッション取得のエラー */
  error?: string;
};

export type SaveSleepLogResult = SaveSleepLogSuccess | SaveSleepLogFailure;

/**
 * 再生終了時に sleep_logs へ記録する。
 * ログイン中のみ保存。未ログイン時は insert せず warning を返す。
 */
export async function saveSleepLog(
  duration_sec: number,
  sound_id: string,
  wake_score: number,
): Promise<SaveSleepLogResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("[saveSleepLog] getUser:", userError.message);
    return { ok: false, error: userError.message };
  }

  const userId = user?.id;
  if (!userId) {
    const warning =
      "ログインしていないため、睡眠ログは保存されませんでした。";
    console.warn("[saveSleepLog]", warning);
    return { ok: false, warning };
  }

  const { data, error } = await supabase
    .from("sleep_logs")
    .insert({
      user_id: userId,
      duration_sec,
      sound_id,
      wake_score,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[saveSleepLog]", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data.id };
}
