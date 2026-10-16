// Server-only data access for the storefront. Shared by server functions (UI) and REST routes.
import { exec, one, rows } from "./db.server";
import type { Locale } from "@/i18n/locales";
import { listOffersSchema, type CategoryNode, type ListOffersInput, type OfferCardDTO } from "./catalog.schemas";

const tr = (alias: string, type: "offer" | "category", idExpr: string) =>
  `LEFT JOIN content_translations ${alias} ON ${alias}.entity_type = '${type}' AND ${alias}.entity_id = ${idExpr} AND ${alias}.locale = ?`;
export const OFFER_TR = tr("t", "offer", "CAST(o.id AS CHAR)");
const CARD = "o.id, o.slug, COALESCE(t.title, o.title) AS title, o.image_url, o.price_minor, o.old_price_minor, o.currency, o.sales_count";

export async function getCategoryTree(locale: Locale): Promise<CategoryNode[]> {
  const data = await rows<Omit<CategoryNode, "children">>(
    `SELECT c.id, c.parent_id, c.slug, COALESCE(t.title, c.name) AS name, c.icon, COALESCE(t.description, c.seo_text) AS seo_text,
       c.sort_order, c.show_in_header FROM categories c ${tr("t", "category", "c.id")} WHERE c.is_active = 1 ORDER BY c.sort_order`,
    [locale],
  );
  const nodes = new Map<string, CategoryNode>();
  for (const c of data) nodes.set(c.id, { ...c, children: [] });
  const roots: CategoryNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parent_id ? nodes.get(n.parent_id) : undefined;
    if (parent) parent.children.push(n);
    else if (!n.parent_id) roots.push(n);
  }
  return roots;
}

export function flattenTree(tree: CategoryNode[]): CategoryNode[] {
  return tree.flatMap((n) => [n, ...flattenTree(n.children)]);
}

export function categoryPath(tree: CategoryNode[], id: string): CategoryNode[] {
  const byId = new Map(flattenTree(tree).map((n) => [n.id, n]));
  const path: CategoryNode[] = [];
  let cur = byId.get(id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}

function subtreeIds(tree: CategoryNode[], slugValue: string) {
  const node = flattenTree(tree).find((n) => n.slug === slugValue);
  return node ? flattenTree([node]).map((n) => n.id) : null;
}

type Cursor = { v: number; id: number };
const encodeCursor = (c: Cursor) => btoa(JSON.stringify(c)).replace(/=+$/, "");
function decodeCursor(s?: string): Cursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(atob(s));
    if (Number.isSafeInteger(c.v) && Number.isSafeInteger(c.id)) return c;
  } catch {
    /* invalid cursor */
  }
  return null;
}

export async function listOffers(raw: ListOffersInput, locale: Locale) {
  const input = listOffersSchema.parse(raw);
  const where = ["o.status = 'active'"];
  const params: unknown[] = [locale];
  if (input.categorySlug) {
    const ids = subtreeIds(await getCategoryTree(locale), input.categorySlug);
    if (!ids?.length) return { items: [] as OfferCardDTO[], nextCursor: null };
    where.push("o.category_id IN (?)");
    params.push(ids);
  }
  if (input.sellerId) {
    where.push("o.seller_id = ?");
    params.push(input.sellerId);
  }
  const term = input.q?.replace(/[%_\\]/g, " ").trim();
  if (term) {
    where.push("(o.title LIKE ? OR t.title LIKE ?)");
    params.push(`%${term}%`, `%${term}%`);
  }
  const c = decodeCursor(input.cursor);
  let order: string;
  switch (input.sort) {
    case "price_asc":
      if (c) { where.push("(o.price_minor > ? OR (o.price_minor = ? AND o.id > ?))"); params.push(c.v, c.v, c.id); }
      order = "o.price_minor ASC, o.id ASC";
      break;
    case "price_desc":
      if (c) { where.push("(o.price_minor < ? OR (o.price_minor = ? AND o.id < ?))"); params.push(c.v, c.v, c.id); }
      order = "o.price_minor DESC, o.id DESC";
      break;
    case "newest":
      if (c) { where.push("o.id < ?"); params.push(c.id); }
      order = "o.id DESC";
      break;
    default:
      if (c) { where.push("(o.sales_count < ? OR (o.sales_count = ? AND o.id < ?))"); params.push(c.v, c.v, c.id); }
      order = "o.sales_count DESC, o.id DESC";
  }
  params.push(input.limit + 1);
  const data = await rows<OfferCardDTO>(
    `SELECT ${CARD} FROM offers o ${OFFER_TR} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`, params);
  const hasMore = data.length > input.limit;
  const items = data.slice(0, input.limit);
  const last = items[items.length - 1];
  const sortVal = (o: OfferCardDTO) => (input.sort === "popular" ? o.sales_count : input.sort === "newest" ? o.id : o.price_minor);
  return { items, nextCursor: hasMore && last ? encodeCursor({ v: sortVal(last), id: last.id }) : null };
}

export async function getCategoryBySlug(slugValue: string, locale: Locale) {
  const tree = await getCategoryTree(locale);
  const node = flattenTree(tree).find((n) => n.slug === slugValue);
  if (!node) return null;
  const ids = flattenTree([node]).map((n) => n.id);
  const count = await one<{ n: number }>("SELECT COUNT(*) n FROM offers WHERE status = 'active' AND category_id IN (?)", [ids]);
  return { category: node, path: categoryPath(tree, node.id), offerCount: count?.n ?? 0 };
}

type FieldRow = { id: string; key: string; label: string; type: "text" | "select" | "number"; select_options: string | null; required: boolean; sort_order: number };

export async function getOffer(id: number, locale: Locale) {
  const offer = await one<{
    id: number; slug: string; title: string; description: string; image_url: string | null; price_minor: number;
    old_price_minor: number | null; currency: string; delivery_type: "auto_codes" | "manual"; stock_count: number;
    sales_count: number; region: string | null; platform: string | null; category_id: string; seller_id: string; created_at: Date;
  }>(
    `SELECT o.id, o.slug, COALESCE(t.title, o.title) AS title, COALESCE(t.description, o.description) AS description, o.image_url,
       o.price_minor, o.old_price_minor, o.currency, o.delivery_type, o.stock_count, o.sales_count, o.region, o.platform,
       o.category_id, o.seller_id, o.created_at FROM offers o ${OFFER_TR} WHERE o.id = ? AND o.status = 'active'`,
    [locale, id],
  );
  if (!offer) return null;
  const [options, fields, seller, tree] = await Promise.all([
    rows<{ id: string; label: string; price_minor: number; sort_order: number }>(
      "SELECT id, label, price_minor, sort_order FROM offer_options WHERE offer_id = ? ORDER BY sort_order", [id]),
    rows<FieldRow>(
      "SELECT id, field_key AS `key`, label, type, select_options, required, sort_order FROM offer_input_fields WHERE offer_id = ? ORDER BY sort_order", [id]),
    getSeller(offer.seller_id),
    getCategoryTree(locale),
  ]);
  return {
    offer,
    options,
    fields: fields.map((f) => ({ ...f, select_options: f.select_options ? (JSON.parse(f.select_options) as string[]) : [] })),
    seller,
    categoryPath: categoryPath(tree, offer.category_id).map(({ children: _c, ...n }) => n),
  };
}

export async function getSeller(id: string) {
  return one<{
    user_id: string; display_name: string; bio: string | null; country: string | null; verification_status: string;
    rating_avg: number; rating_count: number; sales_count: number; created_at: Date;
  }>(
    "SELECT user_id, display_name, bio, country, verification_status, rating_avg, rating_count, sales_count, created_at FROM seller_profiles WHERE user_id = ?",
    [id],
  );
}

export const maskEmail = (e: string) => `${e.slice(0, 2)}***`;

export async function getSellerReviews(sellerId: string, locale: Locale, limit = 20) {
  const data = await rows<{ id: number; rating: number; comment: string | null; seller_reply: string | null; created_at: Date; email: string; offer_title: string }>(
    `SELECT r.id, r.rating, r.comment, r.seller_reply, r.created_at, u.email, COALESCE(t.title, o.title) AS offer_title
     FROM reviews r JOIN users u ON u.id = r.buyer_id JOIN offers o ON o.id = r.offer_id ${OFFER_TR}
     WHERE r.seller_id = ? AND r.status = 'visible' ORDER BY r.id DESC LIMIT ?`,
    [locale, sellerId, limit],
  );
  return data.map(({ email, ...r }) => ({ ...r, buyer: maskEmail(email) }));
}

export async function listFavorites(userId: string, locale: Locale) {
  return rows<OfferCardDTO>(
    `SELECT ${CARD} FROM favorites f JOIN offers o ON o.id = f.offer_id ${OFFER_TR} WHERE f.user_id = ? ORDER BY f.created_at DESC`,
    [locale, userId],
  );
}

export async function setFavorite(userId: string, offerId: number, on: boolean) {
  if (on) await exec("INSERT IGNORE INTO favorites (user_id, offer_id) SELECT ?, id FROM offers WHERE id = ? AND status = 'active'", [userId, offerId]);
  else await exec("DELETE FROM favorites WHERE user_id = ? AND offer_id = ?", [userId, offerId]);
}
