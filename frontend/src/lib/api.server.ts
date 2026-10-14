import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ZodError } from "zod";

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers });

export function handleError(e: unknown) {
  if (e instanceof ZodError) return json({ error: "invalid_input", issues: e.issues }, 400);
  console.error(e);
  return json({ error: "server_error" }, 500);
}

/** Returns a user-scoped client (RLS applies) and user id, or null when the bearer is missing/invalid. */
export async function authFromRequest(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return { sb, userId: data.user.id };
}
