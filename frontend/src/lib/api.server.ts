import { ZodError } from "zod";
import { SESSION_COOKIE, loadUser, verifyToken } from "./auth.server";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/locales";

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers });

export function handleError(e: unknown) {
  if (e instanceof ZodError) return json({ error: "invalid_input", issues: e.issues }, 400);
  console.error(e);
  return json({ error: "server_error" }, 500);
}

const cookie = (request: Request, name: string) =>
  new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(request.headers.get("cookie") ?? "")?.[1];

/** User from `Authorization: Bearer <access_token>` or the session cookie. */
export async function userFromRequest(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const id = bearer ? await verifyToken(bearer, "access") : await verifyToken(cookie(request, SESSION_COOKIE), "session");
  return id ? loadUser(id) : null;
}

export function localeFrom(request: Request): Locale {
  const q = new URL(request.url).searchParams.get("locale");
  const c = q ?? cookie(request, LOCALE_COOKIE);
  return isLocale(c) ? c : "en";
}
