import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (err) {
    console.error("[middleware]", err);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    /*
     * Avoid running auth refresh on static assets (CSS/JS/fonts etc.).
     * If middleware touches these requests, styles can fail to load in dev/production.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|map|woff2?|ttf|otf)$).*)",
  ],
};
