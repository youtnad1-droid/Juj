const EMAIL_BASE_URL = "https://integrations.emergentagent.com";
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly"];
const CRED_ASK = ["reply with your password", "reply with the code", "send your password", "cvv", "seed phrase",
  "send us your password", "enter your password below", "confirm your card number", "verify your card"];

export const appUrl = () => (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
const fromName = () => process.env.EMAIL_FROM_NAME ?? "";
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function assertSafeEmail(subject: string, html: string) {
  if (/<\s*(form|input|textarea|select)\b/i.test(html)) throw new Error("No forms in email");
  const body = `${subject}\n${html}`.toLowerCase();
  for (const p of CRED_ASK) if (body.includes(p)) throw new Error(`Credential ask in email: ${p}`);
  for (const [, url] of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    if (/^(mailto:|tel:|cid:|#)/i.test(url)) continue;
    if (!/^https:\/\//i.test(url)) throw new Error(`Email links must be https: ${url}`);
    const u = new URL(url);
    const h = u.hostname;
    if (!h || h.includes("xn--") || /^[\d.]+$/.test(h) || h.includes(":") || u.username ||
      SHORTENERS.some((s) => h === s || h.endsWith(`.${s}`))) throw new Error(`Unsafe link: ${url}`);
  }
}

function layout(title: string, lines: string[], cta?: { label: string; path: string }) {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${appUrl()}${cta.path}" style="background:#b5e83f;color:#1f2329;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(cta.label)}</a></p>`
    : "";
  return `<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1f2329">
<h2 style="margin:0 0 12px">${esc(title)}</h2>${lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join("")}${button}
<p style="font-size:12px;color:#888">Sent by ${esc(fromName())}. We never ask for your password or card details by email.</p></td></tr></table>`;
}

type Templates = {
  verify: { token: string };
  reset: { token: string };
  order_paid: { orderId: number; title: string; delivered: boolean };
  new_order: { orderId: number; title: string };
  order_delivered: { orderId: number; title: string };
  dispute: { orderId: number; title: string };
};

function render<K extends keyof Templates>(kind: K, v: Templates[K]): { subject: string; html: string } {
  const n = fromName();
  const a = v as Record<string, string | number | boolean>;
  switch (kind) {
    case "verify":
      return { subject: `Confirm your ${n} email`, html: layout("Confirm your email", ["Click the button to confirm your email address. The link expires in 24 hours."], { label: "Confirm email", path: `/verify-email?token=${encodeURIComponent(String(a.token))}` }) };
    case "reset":
      return { subject: `Reset your ${n} password`, html: layout("Reset your password", ["Click the button to choose a new password. The link expires in 1 hour.", "If you didn't ask for this, you can ignore this email."], { label: "Choose a new password", path: `/reset-password?token=${encodeURIComponent(String(a.token))}` }) };
    case "order_paid":
      return { subject: `Payment received for order #${a.orderId}`, html: layout(`Order #${a.orderId} is paid`, [String(a.title), a.delivered ? "Your item is ready on the order page." : "The seller has been notified and will deliver soon."], { label: "Open order", path: `/orders/${a.orderId}` }) };
    case "new_order":
      return { subject: `New order #${a.orderId}`, html: layout(`New order #${a.orderId}`, [String(a.title), "Open the order to check the buyer's details and deliver."], { label: "Open order", path: `/orders/${a.orderId}` }) };
    case "order_delivered":
      return { subject: `Order #${a.orderId} was delivered`, html: layout(`Order #${a.orderId} was delivered`, [String(a.title), "Check the order page, then confirm you received it."], { label: "Open order", path: `/orders/${a.orderId}` }) };
    default:
      return { subject: `Dispute opened on order #${a.orderId}`, html: layout(`Dispute on order #${a.orderId}`, [String(a.title), "The buyer opened a dispute. Reply in the order chat."], { label: "Open order", path: `/orders/${a.orderId}` }) };
  }
}

/** Sends a fixed server-side template. Never throws: email problems are logged for the owner. */
export async function sendTemplate<K extends keyof Templates>(to: string, kind: K, vars: Templates[K]) {
  const { subject, html } = render(kind, vars);
  if (process.env.NODE_ENV !== "production" && "token" in vars) {
    console.log(`[email:${kind}] ${to} -> ${html.match(/href="([^"]+)"/)?.[1]}`);
  }
  try {
    assertSafeEmail(subject, html);
    const r = await fetch(`${EMAIL_BASE_URL}/api/v1/email/send`, {
      method: "POST",
      headers: { "X-Email-Key": process.env.EMERGENT_EMAIL_KEY ?? "", "content-type": "application/json" },
      body: JSON.stringify({ to: [to], subject, html, from_name: fromName() }),
    });
    if (!r.ok) console.warn(`[email] ${kind} to ${to} failed: ${r.status} ${await r.text()}`);
  } catch (e) {
    console.error(`[email] ${kind} error`, e);
  }
}
