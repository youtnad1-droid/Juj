import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { exec, one } from "./db.server";
import { loginSchema, passwordSchema, registerSchema } from "./catalog.schemas";
import { sendTemplate } from "./email.server";
import { m } from "./msg";

export type Role = "buyer" | "seller" | "admin";
export type SessionUser = { id: string; email: string; role: Role; display_name: string | null };
type Result = { ok: true } | { ok: false; error: string; retryAfterSec?: number };

const ACCESS_TTL = 15 * 60;
const SESSION_TTL = 7 * 24 * 3600;
const key = () => new TextEncoder().encode(process.env["JWT_SECRET"]);
const cookieOpts = (maxAge: number) => ({ httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge });
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

type TokenType = "access" | "session";
export const SESSION_COOKIE = "juj_session";

export const signToken = (sub: string, type: TokenType, ttl: number) =>
  new SignJWT({ type }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl).sign(key());

export async function verifyToken(token: string | undefined | null, type: TokenType) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload.type === type && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function loadUser(id: string): Promise<SessionUser | null> {
  const u = await one<SessionUser & { status: string }>(
    "SELECT u.id, u.email, u.role, u.status, s.display_name FROM users u LEFT JOIN seller_profiles s ON s.user_id = u.id WHERE u.id = ?",
    [id],
  );
  return u && u.status === "active" ? { id: u.id, email: u.email, role: u.role, display_name: u.display_name } : null;
}

// One cookie per response: the SSR adapter keeps only the last Set-Cookie header.
export async function startSession(userId: string) {
  setCookie(SESSION_COOKIE, await signToken(userId, "session", SESSION_TTL), cookieOpts(SESSION_TTL));
}

export function endSession() {
  deleteCookie(SESSION_COOKIE, { path: "/", httpOnly: true, secure: true, sameSite: "lax" });
}

export async function currentUser(): Promise<SessionUser | null> {
  const id = await verifyToken(getCookie(SESSION_COOKIE), "session");
  return id ? loadUser(id) : null;
}

export async function requireUser(...roles: Role[]) {
  const u = await currentUser();
  if (!u) throw new Error(m("Please log in first."));
  if (roles.length && !roles.includes(u.role)) throw new Error(m("You don't have access to this page."));
  return u;
}

export async function login(raw: unknown, ip: string) {
  const p = loginSchema.safeParse(raw);
  if (!p.success) return { ok: false as const, error: m("Enter a valid email and password.") };
  const { email, password } = p.data;
  const recent = "success = 0 AND created_at > NOW() - INTERVAL 15 MINUTE";
  const [byEmail, byIp] = await Promise.all([
    one<{ n: number }>(`SELECT COUNT(*) n FROM login_attempts WHERE email = ? AND ${recent}`, [email]),
    one<{ n: number }>(`SELECT COUNT(*) n FROM login_attempts WHERE ip = ? AND ${recent}`, [ip]),
  ]);
  if ((byEmail?.n ?? 0) >= 5 || (byIp?.n ?? 0) >= 20) {
    return { ok: false as const, error: m("Too many attempts. Try again in 15 minutes."), retryAfterSec: 900 };
  }
  const u = await one<{ id: string; password_hash: string; status: string; email_verified_at: Date | null }>(
    "SELECT id, password_hash, status, email_verified_at FROM users WHERE email = ?", [email]);
  const good = !!u && (await bcrypt.compare(password, u.password_hash));
  await exec("INSERT INTO login_attempts (email, ip, success) VALUES (?, ?, ?)", [email, ip, good]);
  if (!u || !good) return { ok: false as const, error: m("Wrong email or password.") };
  if (u.status !== "active") return { ok: false as const, error: m("This account is suspended. Contact support.") };
  if (!u.email_verified_at) return { ok: false as const, error: m("Please confirm your email first. Check your inbox.") };
  await exec("DELETE FROM login_attempts WHERE email = ? AND success = 0", [email]);
  return { ok: true as const, userId: u.id, access_token: await signToken(u.id, "access", ACCESS_TTL) };
}

async function createToken(userId: string, type: "verify_email" | "reset_password", minutes: number) {
  const raw = randomBytes(32).toString("base64url");
  await exec("INSERT INTO auth_tokens (user_id, type, token_hash, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL ? MINUTE)",
    [userId, type, sha256(raw), minutes]);
  return raw;
}

async function consumeToken(raw: string, type: "verify_email" | "reset_password") {
  const row = await one<{ id: number; user_id: string }>(
    "SELECT id, user_id FROM auth_tokens WHERE token_hash = ? AND type = ? AND used_at IS NULL AND expires_at > NOW()",
    [sha256(raw), type]);
  if (!row) return null;
  const r = await exec("UPDATE auth_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL", [row.id]);
  return r.affectedRows === 1 ? row.user_id : null;
}

async function tooManyTokens(userId: string) {
  const c = await one<{ n: number }>("SELECT COUNT(*) n FROM auth_tokens WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 HOUR", [userId]);
  return (c?.n ?? 0) >= 5;
}

export async function register(raw: unknown): Promise<Result> {
  const p = registerSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? m("Invalid input") };
  const exists = await one("SELECT id FROM users WHERE email = ?", [p.data.email]);
  if (exists) return { ok: true };
  const id = randomUUID();
  await exec("INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, 'buyer')",
    [id, p.data.email, await bcrypt.hash(p.data.password, 10)]);
  await sendTemplate(p.data.email, "verify", { token: await createToken(id, "verify_email", 60 * 24) });
  return { ok: true };
}

export async function resendVerification(email: string): Promise<Result> {
  const u = await one<{ id: string; email: string }>("SELECT id, email FROM users WHERE email = ? AND email_verified_at IS NULL", [email.trim().toLowerCase()]);
  if (u && !(await tooManyTokens(u.id))) await sendTemplate(u.email, "verify", { token: await createToken(u.id, "verify_email", 60 * 24) });
  return { ok: true };
}

export async function verifyEmail(token: string): Promise<Result> {
  const uid = await consumeToken(token, "verify_email");
  if (!uid) return { ok: false, error: m("This link is invalid or expired.") };
  await exec("UPDATE users SET email_verified_at = NOW() WHERE id = ? AND email_verified_at IS NULL", [uid]);
  await startSession(uid);
  return { ok: true };
}

export async function forgotPassword(email: string): Promise<Result> {
  const u = await one<{ id: string; email: string }>("SELECT id, email FROM users WHERE email = ? AND status = 'active'", [email.trim().toLowerCase()]);
  if (u && !(await tooManyTokens(u.id))) await sendTemplate(u.email, "reset", { token: await createToken(u.id, "reset_password", 60) });
  return { ok: true };
}

export async function resetPassword(token: string, password: string): Promise<Result> {
  const p = passwordSchema.safeParse(password);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? m("Invalid password") };
  const uid = await consumeToken(token, "reset_password");
  if (!uid) return { ok: false, error: m("This reset link is invalid or expired. Request a new one.") };
  await exec("UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?",
    [await bcrypt.hash(p.data, 10), uid]);
  await startSession(uid);
  return { ok: true };
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
