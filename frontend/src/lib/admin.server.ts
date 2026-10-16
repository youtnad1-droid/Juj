import { randomUUID } from "node:crypto";
import { exec, one, rows, tx } from "./db.server";
import { categoryEditSchema, settingsSchema, type CategoryEditInput } from "./panel.schemas";
import { autoCompleteOrders, completeOrder, refundOrder } from "./orders.server";
import { getSettings, saveSettings } from "./settings.server";
import { configuredProviders } from "./payments.server";
import { translateItems } from "./translate.server";
import { m } from "./msg";

const like = (q?: string) => `%${(q ?? "").replace(/[%_\\]/g, " ").trim()}%`;

export async function adminStats() {
  await autoCompleteOrders();
  const [users, offers, orders, money, payouts, recent] = await Promise.all([
    rows<{ role: string; n: number }>("SELECT role, COUNT(*) n FROM users GROUP BY role"),
    one<{ active: number; total: number }>("SELECT SUM(status = 'active') active, COUNT(*) total FROM offers WHERE status <> 'archived'"),
    rows<{ status: string; n: number }>("SELECT status, COUNT(*) n FROM orders GROUP BY status"),
    one<{ gmv: number; commission: number }>(
      "SELECT COALESCE(SUM(total_minor), 0) gmv, COALESCE(SUM(CASE WHEN status = 'completed' THEN commission_minor END), 0) commission FROM orders WHERE status IN ('paid', 'delivered', 'completed', 'disputed')"),
    one<{ n: number; amount: number }>("SELECT COUNT(*) n, COALESCE(SUM(amount_minor), 0) amount FROM payouts WHERE status = 'requested'"),
    rows<{ id: number; offer_title: string; total_minor: number; currency: string; status: string; created_at: Date }>(
      "SELECT id, offer_title, total_minor, currency, status, created_at FROM orders ORDER BY id DESC LIMIT 8"),
  ]);
  return {
    users: Object.fromEntries(users.map((u) => [u.role, Number(u.n)])) as Record<string, number>,
    offers: { active: Number(offers?.active ?? 0), total: Number(offers?.total ?? 0) },
    orders: Object.fromEntries(orders.map((o) => [o.status, Number(o.n)])) as Record<string, number>,
    gmv: Number(money?.gmv ?? 0),
    commission: Number(money?.commission ?? 0),
    payouts: { n: Number(payouts?.n ?? 0), amount: Number(payouts?.amount ?? 0) },
    recent,
  };
}

export async function listUsers(q?: string, role?: string) {
  const params: unknown[] = [like(q)];
  let where = "u.email LIKE ?";
  if (role) { where += " AND u.role = ?"; params.push(role); }
  return rows<{ id: string; email: string; role: string; status: string; email_verified_at: Date | null; created_at: Date; display_name: string | null }>(
    `SELECT u.id, u.email, u.role, u.status, u.email_verified_at, u.created_at, s.display_name FROM users u
     LEFT JOIN seller_profiles s ON s.user_id = u.id WHERE ${where} ORDER BY u.created_at DESC LIMIT 200`, params);
}

export async function updateUser(adminId: string, id: string, patch: { role?: string; status?: string; verify?: boolean }) {
  if (id === adminId && (patch.role || patch.status)) throw new Error(m("You can't change your own role or status."));
  if (patch.role) {
    await exec("UPDATE users SET role = ? WHERE id = ?", [patch.role, id]);
    if (patch.role === "seller") {
      await exec("INSERT IGNORE INTO seller_profiles (user_id, display_name) SELECT id, LEFT(SUBSTRING_INDEX(email, '@', 1), 60) FROM users WHERE id = ?", [id]);
    }
  }
  if (patch.status) await exec("UPDATE users SET status = ? WHERE id = ?", [patch.status, id]);
  if (patch.verify) await exec("UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?", [id]);
}

export async function listSellers() {
  return rows<{ user_id: string; email: string; display_name: string; verification_status: string; rating_avg: number; rating_count: number; sales_count: number; balance_minor: number; pending_minor: number; offers: number }>(
    `SELECT s.user_id, u.email, s.display_name, s.verification_status, s.rating_avg, s.rating_count, s.sales_count, s.balance_minor, s.pending_minor,
       (SELECT COUNT(*) FROM offers o WHERE o.seller_id = s.user_id AND o.status = 'active') offers
     FROM seller_profiles s JOIN users u ON u.id = s.user_id ORDER BY s.sales_count DESC`);
}

export async function setSellerVerification(id: string, status: string) {
  await exec("UPDATE seller_profiles SET verification_status = ? WHERE user_id = ?", [status, id]);
}

export async function listCategoriesAdmin() {
  return rows<{ id: string; parent_id: string | null; slug: string; name: string; icon: string | null; seo_text: string | null; commission_percent: number; sort_order: number; show_in_header: boolean; is_active: boolean; offers: number }>(
    `SELECT c.*, (SELECT COUNT(*) FROM offers o WHERE o.category_id = c.id AND o.status <> 'archived') offers FROM categories c ORDER BY c.sort_order, c.name`);
}

export async function saveCategory(raw: CategoryEditInput) {
  const d = categoryEditSchema.parse(raw);
  if (d.id && d.parent_id === d.id) throw new Error(m("A category can't be its own parent."));
  const dup = await one("SELECT id FROM categories WHERE slug = ? AND id <> ?", [d.slug, d.id ?? ""]);
  if (dup) throw new Error(m("This slug is already used."));
  const id = d.id ?? randomUUID();
  const vals = [d.parent_id, d.slug, d.name, d.icon || null, d.seo_text || null, d.commission_percent, d.sort_order, d.show_in_header, d.is_active];
  if (d.id) {
    await exec("UPDATE categories SET parent_id = ?, slug = ?, name = ?, icon = ?, seo_text = ?, commission_percent = ?, sort_order = ?, show_in_header = ?, is_active = ? WHERE id = ?", [...vals, id]);
  } else {
    await exec("INSERT INTO categories (parent_id, slug, name, icon, seo_text, commission_percent, sort_order, show_in_header, is_active, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [...vals, id]);
  }
  void translateItems([{ type: "category", id, title: d.name, description: d.seo_text }]);
  return { id };
}

export async function deleteCategory(id: string) {
  const used = await one<{ kids: number; offers: number }>(
    "SELECT (SELECT COUNT(*) FROM categories WHERE parent_id = ?) kids, (SELECT COUNT(*) FROM offers WHERE category_id = ?) offers", [id, id]);
  if (Number(used?.kids) || Number(used?.offers)) throw new Error(m("Move its sub-categories and offers first, or turn the category off instead."));
  await exec("DELETE FROM content_translations WHERE entity_type = 'category' AND entity_id = ?", [id]);
  await exec("DELETE FROM categories WHERE id = ?", [id]);
}

export async function listOffersAdmin(q?: string, status?: string) {
  const params: unknown[] = [like(q)];
  let where = "o.title LIKE ?";
  if (status) { where += " AND o.status = ?"; params.push(status); }
  return rows<{ id: number; slug: string; title: string; price_minor: number; currency: string; status: string; stock_count: number; sales_count: number; seller: string; category: string }>(
    `SELECT o.id, o.slug, o.title, o.price_minor, o.currency, o.status, o.stock_count, o.sales_count, s.display_name seller, c.name category
     FROM offers o JOIN seller_profiles s ON s.user_id = o.seller_id JOIN categories c ON c.id = o.category_id WHERE ${where} ORDER BY o.id DESC LIMIT 300`, params);
}

export async function setOfferStatus(id: number, status: string) {
  await exec("UPDATE offers SET status = ? WHERE id = ?", [status, id]);
}

export async function listOrdersAdmin(status?: string, q?: string) {
  await autoCompleteOrders();
  const params: unknown[] = [];
  const where: string[] = [];
  if (status) { where.push("o.status = ?"); params.push(status); }
  if (q) { where.push("(o.id = ? OR o.offer_title LIKE ? OR u.email LIKE ?)"); params.push(Number(q) || 0, like(q), like(q)); }
  return rows<{ id: number; offer_title: string; total_minor: number; commission_minor: number; currency: string; status: string; payment_provider: string; created_at: Date; buyer: string; seller: string }>(
    `SELECT o.id, o.offer_title, o.total_minor, o.commission_minor, o.currency, o.status, o.payment_provider, o.created_at, u.email buyer, s.display_name seller
     FROM orders o JOIN users u ON u.id = o.buyer_id JOIN seller_profiles s ON s.user_id = o.seller_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY o.id DESC LIMIT 300`, params);
}

export async function resolveOrder(id: number, action: "refund" | "release" | "cancel") {
  if (action === "refund") return refundOrder(id);
  if (action === "release") return completeOrder(id, m("The platform team completed this order and released the payment to the seller."));
  const r = await exec("UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending_payment'", [id]);
  return r.affectedRows === 1;
}

export async function listReviewsAdmin() {
  return rows<{ id: number; order_id: number; rating: number; comment: string | null; seller_reply: string | null; status: string; created_at: Date; buyer: string; seller: string; offer_title: string }>(
    `SELECT r.id, r.order_id, r.rating, r.comment, r.seller_reply, r.status, r.created_at, u.email buyer, s.display_name seller, o.title offer_title
     FROM reviews r JOIN users u ON u.id = r.buyer_id JOIN seller_profiles s ON s.user_id = r.seller_id JOIN offers o ON o.id = r.offer_id ORDER BY r.id DESC LIMIT 300`);
}

export async function setReviewStatus(id: number, status: "visible" | "hidden" | "delete") {
  if (status !== "delete") return void (await exec("UPDATE reviews SET status = ? WHERE id = ?", [status, id]));
  await tx(async (c) => {
    const r = await one<{ seller_id: string; rating: number }>("SELECT seller_id, rating FROM reviews WHERE id = ?", [id], c);
    if (!r) return;
    await exec("DELETE FROM reviews WHERE id = ?", [id], c);
    await exec(
      "UPDATE seller_profiles SET rating_avg = IF(rating_count > 1, ROUND((rating_avg * rating_count - ?) / (rating_count - 1), 2), 0), rating_count = GREATEST(rating_count - 1, 0) WHERE user_id = ?",
      [r.rating, r.seller_id], c);
  });
}

export async function listPayoutsAdmin() {
  return rows<{ id: number; amount_minor: number; method: string; details: string; status: string; admin_note: string | null; created_at: Date; seller: string }>(
    "SELECT p.id, p.amount_minor, p.method, p.details, p.status, p.admin_note, p.created_at, s.display_name seller FROM payouts p JOIN seller_profiles s ON s.user_id = p.seller_id ORDER BY p.id DESC LIMIT 300");
}

export async function processPayout(id: number, action: "paid" | "rejected", note: string) {
  await tx(async (c) => {
    const p = await one<{ seller_id: string; amount_minor: number }>("SELECT seller_id, amount_minor FROM payouts WHERE id = ? AND status = 'requested' FOR UPDATE", [id], c);
    if (!p) throw new Error(m("This payout was already processed."));
    await exec("UPDATE payouts SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ?", [action, note || null, id], c);
    if (action === "rejected") await exec("UPDATE seller_profiles SET balance_minor = balance_minor + ? WHERE user_id = ?", [p.amount_minor, p.seller_id], c);
  });
}

export async function adminSettings() {
  return { settings: await getSettings(), configured: configuredProviders() };
}

export async function updateSettings(raw: unknown) {
  await saveSettings(settingsSchema.parse(raw));
}

export async function retranslateAll() {
  const [offers, cats] = await Promise.all([
    rows<{ id: number; title: string; description: string }>("SELECT id, title, description FROM offers WHERE status <> 'archived'"),
    rows<{ id: string; name: string; seo_text: string | null }>("SELECT id, name, seo_text FROM categories"),
  ]);
  const items = [
    ...offers.map((o) => ({ type: "offer" as const, id: String(o.id), title: o.title, description: o.description })),
    ...cats.map((c) => ({ type: "category" as const, id: c.id, title: c.name, description: c.seo_text ?? "" })),
  ];
  void (async () => {
    for (let i = 0; i < items.length; i += 10) await translateItems(items.slice(i, i + 10));
  })();
  return items.length;
}
