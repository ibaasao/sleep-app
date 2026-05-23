/** @supabase/ssr の setAll に渡される Cookie 一覧 */
export type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};
