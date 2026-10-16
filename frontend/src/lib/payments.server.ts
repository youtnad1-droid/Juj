import Stripe from "stripe";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appUrl } from "./email.server";
import type { Provider } from "./settings.server";

type CheckoutOrder = { id: number; title: string; unit: number; quantity: number; total: number; currency: string };
export type PayState = "paid" | "pending" | "failed";

const env = (k: string) => process.env[k] ?? "";
let _stripe: Stripe | undefined;
const stripe = () => (_stripe ??= new Stripe(env("STRIPE_SECRET_KEY")));
const paypalBase = () => (env("PAYPAL_MODE") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
const rzpAuth = () => `Basic ${Buffer.from(`${env("RAZORPAY_KEY_ID")}:${env("RAZORPAY_KEY_SECRET")}`).toString("base64")}`;

export function configuredProviders(): Record<Provider, boolean> {
  return {
    stripe: !!env("STRIPE_SECRET_KEY"),
    paypal: !!(env("PAYPAL_CLIENT_ID") && env("PAYPAL_CLIENT_SECRET")),
    razorpay: !!(env("RAZORPAY_KEY_ID") && env("RAZORPAY_KEY_SECRET")),
    crypto: !!(env("NOWPAYMENTS_API_KEY") && env("NOWPAYMENTS_IPN_SECRET")),
  };
}

const returnUrl = (o: CheckoutOrder, provider: Provider) => `${appUrl()}/checkout/return?order=${o.id}&provider=${provider}`;
const cancelUrl = (o: CheckoutOrder) => `${appUrl()}/orders/${o.id}?cancelled=1`;

async function paypalToken() {
  const r = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env("PAYPAL_CLIENT_ID")}:${env("PAYPAL_CLIENT_SECRET")}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`PayPal auth failed ${r.status}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

async function stripeSession(o: CheckoutOrder) {
  const base: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [{
      quantity: o.quantity,
      price_data: { currency: o.currency.toLowerCase(), unit_amount: o.unit, product_data: { name: o.title.slice(0, 250), tax_code: "txcd_10000000" } },
    }],
    success_url: `${returnUrl(o, "stripe")}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl(o),
    client_reference_id: String(o.id),
    metadata: { order_id: String(o.id) },
  };
  const attempts: Record<string, unknown>[] = [
    { managed_payments: { enabled: true } },
    { automatic_tax: { enabled: true }, billing_address_collection: "required" },
    {},
  ];
  let last: unknown;
  for (const extra of attempts) {
    try {
      return await stripe().checkout.sessions.create({ ...base, ...extra } as Stripe.Checkout.SessionCreateParams);
    } catch (e) {
      last = e;
      if (!(e instanceof Stripe.errors.StripeInvalidRequestError)) throw e;
    }
  }
  throw last;
}

export async function createCheckout(provider: Provider, o: CheckoutOrder): Promise<{ url: string; externalId: string }> {
  const amount = (o.total / 100).toFixed(2);
  if (provider === "stripe") {
    const s = await stripeSession(o);
    return { url: s.url!, externalId: s.id };
  }
  if (provider === "paypal") {
    const r = await fetch(`${paypalBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await paypalToken()}`, "content-type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: String(o.id), description: o.title.slice(0, 120), amount: { currency_code: o.currency, value: amount } }],
        application_context: { return_url: returnUrl(o, "paypal"), cancel_url: cancelUrl(o), user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" },
      }),
    });
    const d = (await r.json()) as { id: string; links?: { rel: string; href: string }[] };
    const link = d.links?.find((l) => l.rel === "approve" || l.rel === "payer-action");
    if (!r.ok || !link) throw new Error(`PayPal order failed ${r.status}`);
    return { url: link.href, externalId: d.id };
  }
  if (provider === "razorpay") {
    const r = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: rzpAuth(), "content-type": "application/json" },
      body: JSON.stringify({
        amount: o.total, currency: o.currency, description: o.title.slice(0, 200),
        reference_id: `juj-${o.id}-${Date.now()}`, callback_url: returnUrl(o, "razorpay"), callback_method: "get",
        notify: { sms: false, email: false },
      }),
    });
    const d = (await r.json()) as { id: string; short_url: string };
    if (!r.ok) throw new Error(`Razorpay link failed ${r.status}`);
    return { url: d.short_url, externalId: d.id };
  }
  const r = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: { "x-api-key": env("NOWPAYMENTS_API_KEY"), "content-type": "application/json" },
    body: JSON.stringify({
      price_amount: Number(amount), price_currency: o.currency.toLowerCase(), order_id: String(o.id),
      order_description: o.title.slice(0, 200), ipn_callback_url: `${appUrl()}/api/payments/crypto/ipn`,
      success_url: returnUrl(o, "crypto"), cancel_url: cancelUrl(o),
    }),
  });
  const d = (await r.json()) as { id: string | number; invoice_url: string };
  if (!r.ok) throw new Error(`NOWPayments invoice failed ${r.status}`);
  return { url: d.invoice_url, externalId: String(d.id) };
}

/** Asks the provider whether the payment went through. Crypto is confirmed only by its signed IPN. */
export async function checkPayment(provider: Provider, externalId: string, txStatus: string): Promise<PayState> {
  if (provider === "stripe") {
    const s = await stripe().checkout.sessions.retrieve(externalId);
    if (s.payment_status === "paid" || s.status === "complete") return "paid";
    return s.status === "expired" ? "failed" : "pending";
  }
  if (provider === "paypal") {
    const token = await paypalToken();
    const cap = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(externalId)}/capture`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    if (cap.ok && ((await cap.json()) as { status: string }).status === "COMPLETED") return "paid";
    const r = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(externalId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const st = ((await r.json()) as { status?: string }).status;
    return st === "COMPLETED" ? "paid" : st === "VOIDED" ? "failed" : "pending";
  }
  if (provider === "razorpay") {
    const r = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(externalId)}`, { headers: { Authorization: rzpAuth() } });
    const st = ((await r.json()) as { status?: string }).status;
    return st === "paid" ? "paid" : st === "cancelled" || st === "expired" ? "failed" : "pending";
  }
  return txStatus === "paid" ? "paid" : txStatus === "failed" ? "failed" : "pending";
}

export async function refundPayment(provider: Provider, externalId: string): Promise<boolean> {
  if (provider !== "stripe") return false;
  try {
    const s = await stripe().checkout.sessions.retrieve(externalId);
    if (!s.payment_intent) return false;
    await stripe().refunds.create({ payment_intent: String(s.payment_intent) });
    return true;
  } catch (e) {
    console.error("[refund] stripe", e);
    return false;
  }
}

export function stripeEvent(body: string, sig: string) {
  return stripe().webhooks.constructEvent(body, sig, env("STRIPE_WEBHOOK_SECRET"));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  }
  return v;
}

export function verifyNowPayments(body: unknown, sig: string) {
  const expected = createHmac("sha512", env("NOWPAYMENTS_IPN_SECRET")).update(JSON.stringify(sortKeys(body))).digest("hex");
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
