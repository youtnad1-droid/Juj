import type { PoolConnection } from "mysql2/promise";
import { exec, one, rows, tx } from "./db.server";
import { checkoutSchema, reviewSchema, type CheckoutInput } from "./catalog.schemas";
import { checkPayment, configuredProviders, createCheckout, refundPayment, type PayState } from "./payments.server";
import { getSettings, type Provider } from "./settings.server";
import { sendTemplate } from "./email.server";
import { maskEmail } from "./catalog.server";
import type { SessionUser } from "./auth.server";
import { m } from "./msg";

export type OrderStatus = "pending_payment" | "paid" | "delivered" | "completed" | "disputed" | "refunded" | "cancelled";
type OrderRow = {
  id: number; buyer_id: string; seller_id: string; offer_id: number; offer_title: string; option_label: string | null;
  quantity: number; unit_price_minor: number; total_minor: number; commission_minor: number; currency: string;
  input_values: string | null; delivery_type: "auto_codes" | "manual"; status: OrderStatus; payment_provider: Provider;
  paid_at: Date | null; delivered_at: Date | null; completed_at: Date | null; created_at: Date;
};

const sysMsg = (orderId: number, body: string, c?: PoolConnection) =>
  exec("INSERT INTO order_messages (order_id, kind, body) VALUES (?, 'system', ?)", [orderId, body], c);
const emailOf = async (id: string) => (await one<{ email: string }>("SELECT email FROM users WHERE id = ?", [id]))?.email;

async function startPayment(order: OrderRow) {
  const { url, externalId } = await createCheckout(order.payment_provider, {
    id: order.id, title: order.offer_title + (order.option_label ? ` — ${order.option_label}` : ""),
    unit: order.unit_price_minor, quantity: order.quantity, total: order.total_minor, currency: order.currency,
  });
  await exec("INSERT INTO payment_transactions (order_id, provider, external_id, amount_minor, currency) VALUES (?, ?, ?, ?, ?)",
    [order.id, order.payment_provider, externalId, order.total_minor, order.currency]);
  await exec("UPDATE orders SET payment_ref = ? WHERE id = ?", [externalId, order.id]);
  return url;
}

export async function availableMethods() {
  const [settings, configured] = [await getSettings(), configuredProviders()];
  return (Object.keys(configured) as Provider[]).map((id) => ({ id, available: settings.payment_methods[id] && configured[id] }));
}

export async function createOrder(user: SessionUser, raw: CheckoutInput) {
  const input = checkoutSchema.parse(raw);
  const methods = await availableMethods();
  if (!methods.find((x) => x.id === input.provider)?.available) return { ok: false as const, error: m("This payment method is not available right now.") };
  const offer = await one<{ id: number; seller_id: string; title: string; price_minor: number; currency: string; delivery_type: "auto_codes" | "manual"; stock_count: number; commission_percent: number }>(
    "SELECT o.id, o.seller_id, o.title, o.price_minor, o.currency, o.delivery_type, o.stock_count, c.commission_percent FROM offers o JOIN categories c ON c.id = o.category_id WHERE o.id = ? AND o.status = 'active'",
    [input.offerId]);
  if (!offer) return { ok: false as const, error: m("This offer isn't available.") };
  if (offer.seller_id === user.id) return { ok: false as const, error: m("You can't buy your own offer.") };
  if (offer.stock_count < input.quantity) return { ok: false as const, error: m("Not enough stock for this quantity.") };
  const options = await rows<{ id: string; label: string; price_minor: number }>("SELECT id, label, price_minor FROM offer_options WHERE offer_id = ?", [offer.id]);
  const opt = options.find((o) => o.id === input.optionId);
  if (options.length && !opt) return { ok: false as const, error: m("Choose an option.") };
  const fields = await rows<{ field_key: string; label: string; type: string; select_options: string | null; required: boolean }>(
    "SELECT field_key, label, type, select_options, required FROM offer_input_fields WHERE offer_id = ? ORDER BY sort_order", [offer.id]);
  const values: Record<string, string> = {};
  for (const f of fields) {
    const v = (input.inputs[f.field_key] ?? "").trim();
    if (!v) {
      if (f.required) return { ok: false as const, error: m("Please fill in all required fields.") };
      continue;
    }
    if (f.type === "number" && !/^\d{1,20}$/.test(v)) return { ok: false as const, error: m("Please fill in all required fields.") };
    if (f.type === "select" && !(JSON.parse(f.select_options ?? "[]") as string[]).includes(v)) return { ok: false as const, error: m("Please fill in all required fields.") };
    values[f.label] = v;
  }
  const unit = opt?.price_minor ?? offer.price_minor;
  const total = unit * input.quantity;
  const commission = Math.round((total * Number(offer.commission_percent)) / 100);
  const r = await exec(
    `INSERT INTO orders (buyer_id, seller_id, offer_id, option_id, offer_title, option_label, quantity, unit_price_minor, total_minor,
       commission_minor, currency, input_values, delivery_type, payment_provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, offer.seller_id, offer.id, opt?.id ?? null, offer.title, opt?.label ?? null, input.quantity, unit, total, commission,
      offer.currency, JSON.stringify(values), offer.delivery_type, input.provider]);
  const order = (await one<OrderRow>("SELECT * FROM orders WHERE id = ?", [r.insertId]))!;
  try {
    return { ok: true as const, orderId: order.id, url: await startPayment(order) };
  } catch (e) {
    console.error("[checkout]", e);
    await exec("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);
    return { ok: false as const, error: m("Could not start the payment. Please try another method.") };
  }
}

export async function retryPayment(user: SessionUser, orderId: number) {
  const order = await one<OrderRow>("SELECT * FROM orders WHERE id = ? AND buyer_id = ? AND status = 'pending_payment'", [orderId, user.id]);
  if (!order) return { ok: false as const, error: m("This order can't be paid anymore.") };
  try {
    return { ok: true as const, url: await startPayment(order) };
  } catch (e) {
    console.error("[checkout:retry]", e);
    return { ok: false as const, error: m("Could not start the payment. Please try another method.") };
  }
}

/** Marks an order paid exactly once, then delivers codes automatically when the offer has them. */
export async function markPaid(orderId: number) {
  const done = await tx(async (c) => {
    const r = await exec("UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = ? AND status = 'pending_payment'", [orderId], c);
    if (r.affectedRows !== 1) return null;
    const o = (await one<OrderRow>("SELECT * FROM orders WHERE id = ?", [orderId], c))!;
    await exec("UPDATE offers SET stock_count = GREATEST(stock_count - ?, 0), sales_count = sales_count + ? WHERE id = ?", [o.quantity, o.quantity, o.offer_id], c);
    await exec("UPDATE seller_profiles SET pending_minor = pending_minor + ?, sales_count = sales_count + ? WHERE user_id = ?",
      [o.total_minor - o.commission_minor, o.quantity, o.seller_id], c);
    await sysMsg(orderId, m("Payment received. The money is held by the platform until the order is completed."), c);
    let delivered = false;
    if (o.delivery_type === "auto_codes") {
      const codes = await rows<{ id: number; code: string }>(
        "SELECT id, code FROM offer_codes WHERE offer_id = ? AND status = 'available' ORDER BY id LIMIT ? FOR UPDATE", [o.offer_id, o.quantity], c);
      if (codes.length === o.quantity) {
        await exec("UPDATE offer_codes SET status = 'sold', order_id = ?, sold_at = NOW() WHERE id IN (?)", [orderId, codes.map((x) => x.id)], c);
        await exec("INSERT INTO order_messages (order_id, kind, body) VALUES (?, 'delivery', ?)", [orderId, codes.map((x) => x.code).join("\n")], c);
        await exec("UPDATE orders SET status = 'delivered', delivered_at = NOW() WHERE id = ?", [orderId], c);
        delivered = true;
      } else {
        await sysMsg(orderId, m("Codes are out of stock right now. The seller will deliver your item manually."), c);
      }
    }
    return { o, delivered };
  });
  if (!done) return;
  const [buyer, seller] = await Promise.all([emailOf(done.o.buyer_id), emailOf(done.o.seller_id)]);
  if (buyer) await sendTemplate(buyer, "order_paid", { orderId, title: done.o.offer_title, delivered: done.delivered });
  if (seller) await sendTemplate(seller, "new_order", { orderId, title: done.o.offer_title });
}

export async function confirmPayment(orderId: number): Promise<OrderStatus | null> {
  const order = await one<{ status: OrderStatus; payment_provider: Provider }>("SELECT status, payment_provider FROM orders WHERE id = ?", [orderId]);
  if (!order || order.status !== "pending_payment") return order?.status ?? null;
  const t = await one<{ id: number; external_id: string; payment_status: string }>(
    "SELECT id, external_id, payment_status FROM payment_transactions WHERE order_id = ? ORDER BY id DESC LIMIT 1", [orderId]);
  if (!t) return order.status;
  let state: PayState = "pending";
  try {
    state = await checkPayment(order.payment_provider, t.external_id, t.payment_status);
  } catch (e) {
    console.error("[payment:check]", e);
  }
  if (state !== "pending") {
    await exec("UPDATE payment_transactions SET status = ?, payment_status = ? WHERE id = ? AND payment_status <> 'paid'",
      [state === "paid" ? "completed" : "failed", state, t.id]);
  }
  if (state === "paid") await markPaid(orderId);
  return (await one<{ status: OrderStatus }>("SELECT status FROM orders WHERE id = ?", [orderId]))!.status;
}

/** Called by provider webhooks after their signature was verified. */
export async function paymentNotified(provider: Provider, externalId: string, state: PayState) {
  const t = await one<{ id: number; order_id: number }>("SELECT id, order_id FROM payment_transactions WHERE provider = ? AND external_id = ?", [provider, externalId]);
  if (!t) return;
  await exec("UPDATE payment_transactions SET status = ?, payment_status = ? WHERE id = ? AND payment_status <> 'paid'",
    [state === "paid" ? "completed" : state, state, t.id]);
  if (state === "paid") await markPaid(t.order_id);
}

export async function completeOrder(orderId: number, note = m("Order completed. The payment was released to the seller.")) {
  return tx(async (c) => {
    const r = await exec("UPDATE orders SET status = 'completed', completed_at = NOW() WHERE id = ? AND status IN ('paid', 'delivered', 'disputed')", [orderId], c);
    if (r.affectedRows !== 1) return false;
    const o = (await one<OrderRow>("SELECT * FROM orders WHERE id = ?", [orderId], c))!;
    const net = o.total_minor - o.commission_minor;
    await exec("UPDATE seller_profiles SET pending_minor = GREATEST(pending_minor - ?, 0), balance_minor = balance_minor + ? WHERE user_id = ?", [net, net, o.seller_id], c);
    await sysMsg(orderId, note, c);
    return true;
  });
}

export async function refundOrder(orderId: number) {
  const ok = await tx(async (c) => {
    const r = await exec("UPDATE orders SET status = 'refunded' WHERE id = ? AND status IN ('paid', 'delivered', 'disputed')", [orderId], c);
    if (r.affectedRows !== 1) return false;
    const o = (await one<OrderRow>("SELECT * FROM orders WHERE id = ?", [orderId], c))!;
    await exec("UPDATE seller_profiles SET pending_minor = GREATEST(pending_minor - ?, 0) WHERE user_id = ?", [o.total_minor - o.commission_minor, o.seller_id], c);
    return true;
  });
  if (!ok) return false;
  const o = (await one<{ payment_provider: Provider; payment_ref: string | null }>("SELECT payment_provider, payment_ref FROM orders WHERE id = ?", [orderId]))!;
  const auto = o.payment_ref ? await refundPayment(o.payment_provider, o.payment_ref) : false;
  await sysMsg(orderId, auto ? m("The order was refunded to the buyer.") : m("The order was refunded. The admin sends the money back through the payment provider."));
  return true;
}

export async function autoCompleteOrders() {
  const { auto_complete_hours } = await getSettings();
  const due = await rows<{ id: number }>(
    "SELECT id FROM orders WHERE status = 'delivered' AND delivered_at < NOW() - INTERVAL ? HOUR LIMIT 100", [auto_complete_hours]);
  for (const d of due) await completeOrder(d.id, m("Order completed automatically. The payment was released to the seller."));
}

const LIST = `SELECT o.id, o.offer_id, o.offer_title, o.option_label, o.quantity, o.total_minor, o.currency, o.status, o.payment_provider,
  o.created_at, f.image_url FROM orders o JOIN offers f ON f.id = o.offer_id`;
export type OrderListItem = { id: number; offer_id: number; offer_title: string; option_label: string | null; quantity: number; total_minor: number; currency: string; status: OrderStatus; payment_provider: Provider; created_at: Date; image_url: string | null };

export async function listBuyerOrders(user: SessionUser) {
  await autoCompleteOrders();
  return rows<OrderListItem>(`${LIST} WHERE o.buyer_id = ? AND o.status <> 'cancelled' ORDER BY o.id DESC LIMIT 200`, [user.id]);
}

export async function listSellerOrders(user: SessionUser, status?: string) {
  await autoCompleteOrders();
  const params: unknown[] = [user.id];
  let where = "o.seller_id = ? AND o.status NOT IN ('pending_payment', 'cancelled')";
  if (status) { where += " AND o.status = ?"; params.push(status); }
  return rows<OrderListItem>(`${LIST} WHERE ${where} ORDER BY o.id DESC LIMIT 200`, params);
}

export async function getOrderDetail(user: SessionUser, id: number) {
  await autoCompleteOrders();
  const o = await one<OrderRow & { seller_name: string; buyer_email: string; image_url: string | null; slug: string }>(
    `SELECT o.*, s.display_name AS seller_name, u.email AS buyer_email, f.image_url, f.slug FROM orders o
     JOIN seller_profiles s ON s.user_id = o.seller_id JOIN users u ON u.id = o.buyer_id JOIN offers f ON f.id = o.offer_id WHERE o.id = ?`, [id]);
  if (!o) return null;
  const role = user.role === "admin" ? "admin" : o.buyer_id === user.id ? "buyer" : o.seller_id === user.id ? "seller" : null;
  if (!role) return null;
  const [messages, review] = await Promise.all([
    rows<{ id: number; kind: "message" | "delivery" | "system"; body: string; created_at: Date; sender_id: string | null }>(
      "SELECT id, kind, body, created_at, sender_id FROM order_messages WHERE order_id = ? ORDER BY id", [id]),
    one<{ id: number; rating: number; comment: string | null; seller_reply: string | null; created_at: Date }>(
      "SELECT id, rating, comment, seller_reply, created_at FROM reviews WHERE order_id = ?", [id]),
  ]);
  const s = o.status;
  const open = ["paid", "delivered", "disputed"].includes(s);
  return {
    role,
    order: {
      id: o.id, offer_id: o.offer_id, slug: o.slug, image_url: o.image_url, offer_title: o.offer_title, option_label: o.option_label,
      quantity: o.quantity, unit_price_minor: o.unit_price_minor, total_minor: o.total_minor, commission_minor: o.commission_minor,
      currency: o.currency, status: s, payment_provider: o.payment_provider, delivery_type: o.delivery_type, seller_id: o.seller_id,
      seller_name: o.seller_name, buyer: role === "seller" ? maskEmail(o.buyer_email) : o.buyer_email,
      inputs: JSON.parse(o.input_values ?? "{}") as Record<string, string>,
      created_at: o.created_at, paid_at: o.paid_at, delivered_at: o.delivered_at, completed_at: o.completed_at,
    },
    messages: messages.map((x) => ({ ...x, mine: x.sender_id === user.id, from: x.sender_id === o.buyer_id ? "buyer" : x.sender_id === o.seller_id ? "seller" : x.sender_id ? "admin" : "system" })),
    review,
    can: {
      pay: role === "buyer" && s === "pending_payment",
      confirm: role === "buyer" && (s === "paid" || s === "delivered"),
      dispute: role === "buyer" && (s === "paid" || s === "delivered"),
      review: role === "buyer" && s === "completed" && !review,
      deliver: role === "seller" && s === "paid",
      reply: role === "seller" && !!review && !review.seller_reply,
      message: s !== "pending_payment" && s !== "cancelled",
      resolve: role === "admin" && open,
      cancel: role === "admin" && s === "pending_payment",
    },
  };
}

async function orderFor(user: SessionUser, id: number) {
  const d = await getOrderDetail(user, id);
  if (!d) throw new Error(m("Order not found."));
  return d;
}

export async function postMessage(user: SessionUser, orderId: number, body: string, deliver = false) {
  const d = await orderFor(user, orderId);
  if (!d.can.message) throw new Error(m("You can't write in this order."));
  if (deliver && !d.can.deliver) throw new Error(m("This order can't be delivered now."));
  await exec("INSERT INTO order_messages (order_id, sender_id, kind, body) VALUES (?, ?, ?, ?)", [orderId, user.id, deliver ? "delivery" : "message", body]);
  if (deliver) {
    await exec("UPDATE orders SET status = 'delivered', delivered_at = NOW() WHERE id = ? AND status = 'paid'", [orderId]);
    const buyer = await one<{ email: string }>("SELECT u.email FROM orders o JOIN users u ON u.id = o.buyer_id WHERE o.id = ?", [orderId]);
    if (buyer) await sendTemplate(buyer.email, "order_delivered", { orderId, title: d.order.offer_title });
  }
}

export async function confirmReceived(user: SessionUser, orderId: number) {
  const d = await orderFor(user, orderId);
  if (!d.can.confirm) throw new Error(m("This order can't be confirmed now."));
  await completeOrder(orderId);
}

export async function openDispute(user: SessionUser, orderId: number, reason: string) {
  const d = await orderFor(user, orderId);
  if (!d.can.dispute) throw new Error(m("You can't open a dispute for this order."));
  const r = await exec("UPDATE orders SET status = 'disputed' WHERE id = ? AND status IN ('paid', 'delivered')", [orderId]);
  if (r.affectedRows !== 1) throw new Error(m("You can't open a dispute for this order."));
  await exec("INSERT INTO order_messages (order_id, sender_id, kind, body) VALUES (?, ?, 'message', ?)", [orderId, user.id, reason]);
  await sysMsg(orderId, m("The buyer opened a dispute. The platform team will review this order."));
  const seller = await emailOf(d.order.seller_id);
  if (seller) await sendTemplate(seller, "dispute", { orderId, title: d.order.offer_title });
}

export async function leaveReview(user: SessionUser, raw: unknown) {
  const input = reviewSchema.parse(raw);
  const d = await orderFor(user, input.orderId);
  if (!d.can.review) throw new Error(m("You can review an order once it is completed."));
  await tx(async (c) => {
    await exec("INSERT INTO reviews (order_id, buyer_id, seller_id, offer_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)",
      [input.orderId, user.id, d.order.seller_id, d.order.offer_id, input.rating, input.comment || null], c);
    await exec(
      "UPDATE seller_profiles SET rating_avg = ROUND((rating_avg * rating_count + ?) / (rating_count + 1), 2), rating_count = rating_count + 1 WHERE user_id = ?",
      [input.rating, d.order.seller_id], c);
  });
}

export async function replyToReview(user: SessionUser, orderId: number, reply: string) {
  const d = await orderFor(user, orderId);
  if (!d.can.reply) throw new Error(m("You can't reply to this review."));
  await exec("UPDATE reviews SET seller_reply = ? WHERE order_id = ? AND seller_id = ?", [reply, orderId, user.id]);
}
