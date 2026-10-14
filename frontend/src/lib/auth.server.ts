// Login with server-side rate limiting. Passwords are hashed and verified by Lovable Cloud auth.
import { publicClient } from "./catalog.server";
import { loginSchema } from "./catalog.schemas";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;

export type LoginResult =
  | { ok: true; access_token: string; refresh_token: string }
  | { ok: false; error: string; retryAfterSec?: number };

export async function loginWithRateLimit(raw: unknown, ip: string): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter a valid email and password." };
  const { email, password } = parsed.data;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const [byEmail, byIp] = await Promise.all([
    supabaseAdmin.from("login_attempts").select("id", { count: "exact", head: true })
      .eq("email", email).eq("success", false).gte("created_at", since),
    supabaseAdmin.from("login_attempts").select("id", { count: "exact", head: true })
      .eq("ip", ip).eq("success", false).gte("created_at", since),
  ]);
  if ((byEmail.count ?? 0) >= MAX_FAILS_PER_EMAIL || (byIp.count ?? 0) >= MAX_FAILS_PER_IP) {
    return { ok: false, error: "Too many attempts. Try again in 15 minutes.", retryAfterSec: 900 };
  }

  const { data, error } = await publicClient().auth.signInWithPassword({ email, password });
  await supabaseAdmin.from("login_attempts").insert({ email, ip, success: !error });

  if (error || !data.session) {
    if (error?.message?.toLowerCase().includes("confirm")) {
      return { ok: false, error: "Please confirm your email first. Check your inbox." };
    }
    return { ok: false, error: "Wrong email or password." };
  }
  return { ok: true, access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
