import { randomUUID } from "node:crypto";
import { exec, one, rows, tx } from "./db.server";
import { offerEditSchema, payoutRequestSchema, sellerProfileSchema, type OfferEditInput } from "./panel.schemas";
import { translateItems } from "./translate.server";
import type { SessionUser } from "./auth.server";
import { m } from "./msg";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150) || "offer";

async function ownOffer(user: SessionUser, id: number) {
  const o = await one<{ id: number; delivery_type: string }>("SELECT id, delivery_type FROM offers WHERE id = ? AND seller_id = ?", [id, user.id]);
  if (!o) throw new Error(m("Offer not found."));
  return o;
}

export async function sellerDashboard(user: SessionUser) {
  const [profile, offers, orders, recent] = await Promise.all([
    one<{ display_name: string; bio: string | null; country: string | null; verification_status: string; rating_avg: number; rating_count: number; sales_count: number; balance_minor: number; pending_minor: number }>(
      "SELECT display_name, bio, country, verification_status, rating_avg, rating_count, sales_count, balance_minor, pending_minor FROM seller_profiles WHERE user_id = ?", [user.id]),
    one<{ active: number; total: number }>("SELECT SUM(status = 'active') active, COUNT(*) total FROM offers WHERE seller_id = ? AND status <> 'archived'", [user.id]),
    one<{ todo: number; disputed: number; revenue: number }>(
      "SELECT SUM(status = 'paid') todo, SUM(status = 'disputed') disputed, COALESCE(SUM(CASE WHEN status = 'completed' THEN total_minor - commission_minor END), 0) revenue FROM orders WHERE seller_id = ?", [user.id]),
    rows<{ id: number; offer_title: string; total_minor: number; currency: string; status: string; created_at: Date }>(
      "SELECT id, offer_title, total_minor, currency, status, created_at FROM orders WHERE seller_id = ? AND status NOT IN ('pending_payment', 'cancelled') ORDER BY id DESC LIMIT 5", [user.id]),
  ]);
  if (!profile) throw new Error(m("Seller profile not found."));
  return { profile, offers: { active: Number(offers?.active ?? 0), total: Number(offers?.total ?? 0) }, orders: { todo: Number(orders?.todo ?? 0), disputed: Number(orders?.disputed ?? 0), revenue: Number(orders?.revenue ?? 0) }, recent };
}

export async function listSellerOffers(user: SessionUser) {
  return rows<{ id: number; slug: string; title: string; image_url: string | null; price_minor: number; currency: string; status: string; stock_count: number; sales_count: number; delivery_type: string; codes: number }>(
    `SELECT o.id, o.slug, o.title, o.image_url, o.price_minor, o.currency, o.status, o.stock_count, o.sales_count, o.delivery_type,
       (SELECT COUNT(*) FROM offer_codes c WHERE c.offer_id = o.id AND c.status = 'available') codes
     FROM offers o WHERE o.seller_id = ? AND o.status <> 'archived' ORDER BY o.id DESC`, [user.id]);
}

export async function getSellerOffer(user: SessionUser, id: number) {
  await ownOffer(user, id);
  const [offer, options, fields, codes] = await Promise.all([
    one<Record<string, unknown>>("SELECT id, title, description, category_id, image_url, price_minor, old_price_minor, delivery_type, stock_count, status, region, platform, slug FROM offers WHERE id = ?", [id]),
    rows<{ label: string; price_minor: number }>("SELECT label, price_minor FROM offer_options WHERE offer_id = ? ORDER BY sort_order", [id]),
    rows<{ key: string; label: string; type: string; select_options: string | null; required: boolean }>(
      "SELECT field_key AS `key`, label, type, select_options, required FROM offer_input_fields WHERE offer_id = ? ORDER BY sort_order", [id]),
    rows<{ id: number; code: string; created_at: Date }>("SELECT id, code, created_at FROM offer_codes WHERE offer_id = ? AND status = 'available' ORDER BY id", [id]),
  ]);
  return { offer, options, fields: fields.map((f) => ({ ...f, select_options: f.select_options ? (JSON.parse(f.select_options) as string[]) : [] })), codes };
}

export async function saveOffer(user: SessionUser, raw: OfferEditInput) {
  const d = offerEditSchema.parse(raw);
  if (d.old_price_minor !== null && d.old_price_minor <= d.price_minor) throw new Error(m("The old price must be higher than the price."));
  const cat = await one("SELECT id FROM categories WHERE id = ? AND is_active = 1", [d.category_id]);
  if (!cat) throw new Error(m("Choose a category."));
  if (d.id) await ownOffer(user, d.id);
  const cols = [user.id, d.category_id, slugify(d.title), d.title, d.description, d.image_url || null, d.price_minor, d.old_price_minor,
    d.delivery_type, d.stock_count, d.status, d.region || null, d.platform || null];
  const id = await tx(async (c) => {
    let offerId = d.id;
    if (offerId) {
      await exec(`UPDATE offers SET seller_id = ?, category_id = ?, slug = ?, title = ?, description = ?, image_url = ?, price_minor = ?,
        old_price_minor = ?, delivery_type = ?, stock_count = ?, status = ?, region = ?, platform = ? WHERE id = ?`, [...cols, offerId], c);
      await exec("DELETE FROM offer_options WHERE offer_id = ?", [offerId], c);
      await exec("DELETE FROM offer_input_fields WHERE offer_id = ?", [offerId], c);
    } else {
      const r = await exec(`INSERT INTO offers (seller_id, category_id, slug, title, description, image_url, price_minor, old_price_minor,
        delivery_type, stock_count, status, region, platform) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, cols, c);
      offerId = r.insertId;
    }
    for (const [i, o] of d.options.entries()) {
      await exec("INSERT INTO offer_options (id, offer_id, label, price_minor, sort_order) VALUES (?, ?, ?, ?, ?)", [randomUUID(), offerId, o.label, o.price_minor, i], c);
    }
    const keys = new Set<string>();
    for (const [i, f] of d.fields.entries()) {
      if (keys.has(f.key)) throw new Error(m("Each input field needs a unique key."));
      keys.add(f.key);
      await exec("INSERT INTO offer_input_fields (id, offer_id, field_key, label, type, select_options, required, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [randomUUID(), offerId, f.key, f.label, f.type, f.type === "select" ? JSON.stringify(f.select_options) : null, f.required, i], c);
    }
    return offerId;
  });
  void translateItems([{ type: "offer", id: String(id), title: d.title, description: d.description }]);
  return { id };
}

export async function archiveOffer(user: SessionUser, id: number) {
  await ownOffer(user, id);
  await exec("UPDATE offers SET status = 'archived' WHERE id = ?", [id]);
}

export async function addCodes(user: SessionUser, offerId: number, codes: string[]) {
  await ownOffer(user, offerId);
  const clean = [...new Set(codes.map((c) => c.trim()).filter((c) => c && c.length <= 500))].slice(0, 1000);
  if (!clean.length) throw new Error(m("Paste at least one code."));
  await tx(async (c) => {
    await exec("INSERT INTO offer_codes (offer_id, code) VALUES ?", [clean.map((code) => [offerId, code])], c);
    await exec("UPDATE offers SET stock_count = stock_count + ? WHERE id = ?", [clean.length, offerId], c);
  });
  return clean.length;
}

export async function deleteCode(user: SessionUser, codeId: number) {
  const code = await one<{ offer_id: number }>(
    "SELECT c.offer_id FROM offer_codes c JOIN offers o ON o.id = c.offer_id WHERE c.id = ? AND o.seller_id = ? AND c.status = 'available'", [codeId, user.id]);
  if (!code) throw new Error(m("Code not found."));
  await exec("DELETE FROM offer_codes WHERE id = ?", [codeId]);
  await exec("UPDATE offers SET stock_count = GREATEST(stock_count - 1, 0) WHERE id = ?", [code.offer_id]);
}

export async function listPayouts(user: SessionUser) {
  return rows<{ id: number; amount_minor: number; method: string; details: string; status: string; admin_note: string | null; created_at: Date; processed_at: Date | null }>(
    "SELECT id, amount_minor, method, details, status, admin_note, created_at, processed_at FROM payouts WHERE seller_id = ? ORDER BY id DESC", [user.id]);
}

export async function requestPayout(user: SessionUser, raw: unknown) {
  const d = payoutRequestSchema.parse(raw);
  await tx(async (c) => {
    const r = await exec("UPDATE seller_profiles SET balance_minor = balance_minor - ? WHERE user_id = ? AND balance_minor >= ?", [d.amount_minor, user.id, d.amount_minor], c);
    if (r.affectedRows !== 1) throw new Error(m("The amount is higher than your available balance."));
    await exec("INSERT INTO payouts (seller_id, amount_minor, method, details) VALUES (?, ?, ?, ?)", [user.id, d.amount_minor, d.method, d.details], c);
  });
}

export async function listMyReviews(user: SessionUser) {
  return rows<{ order_id: number; rating: number; comment: string | null; seller_reply: string | null; created_at: Date; offer_title: string }>(
    "SELECT r.order_id, r.rating, r.comment, r.seller_reply, r.created_at, o.title AS offer_title FROM reviews r JOIN offers o ON o.id = r.offer_id WHERE r.seller_id = ? ORDER BY r.id DESC LIMIT 200", [user.id]);
}

export async function saveSellerProfile(user: SessionUser, raw: unknown) {
  const d = sellerProfileSchema.parse(raw);
  await exec("UPDATE seller_profiles SET display_name = ?, bio = ?, country = ? WHERE user_id = ?", [d.display_name, d.bio || null, d.country || null, user.id]);
}
