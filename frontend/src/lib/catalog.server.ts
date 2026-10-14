// Server-only data access for the storefront. Shared by server functions (UI) and REST routes.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  listOffersSchema,
  type CategoryNode,
  type ListOffersInput,
  type OfferCardDTO,
} from "./catalog.schemas";

export function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const CARD_COLS = "id, slug, title, image_url, price_minor, old_price_minor, currency, sales_count";

export async function getCategoryTree(): Promise<CategoryNode[]> {
  const { data, error } = await publicClient()
    .from("categories")
    .select("id, parent_id, slug, name, icon, seo_text, sort_order, show_in_header")
    .order("sort_order");
  if (error) throw new Error("Failed to load categories");
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
  const all = flattenTree(tree);
  const byId = new Map(all.map((n) => [n.id, n]));
  const path: CategoryNode[] = [];
  let cur = byId.get(id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
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

export async function listOffers(raw: ListOffersInput) {
  const input = listOffersSchema.parse(raw);
  const sb = publicClient();
  let query = sb.from("offers").select(CARD_COLS).eq("status", "active");

  if (input.categorySlug) {
    const { data: cat } = await sb.from("categories").select("id").eq("slug", input.categorySlug).maybeSingle();
    if (!cat) return { items: [] as OfferCardDTO[], nextCursor: null };
    const { data: ids } = await sb.rpc("category_subtree", { _root: cat.id });
    query = query.in("category_id", (ids ?? []) as string[]);
  }
  if (input.sellerId) query = query.eq("seller_id", input.sellerId);
  if (input.q) {
    const term = input.q.replace(/[%_,()\\]/g, " ").trim();
    if (term) query = query.ilike("title", `%${term}%`);
  }

  const c = decodeCursor(input.cursor);
  switch (input.sort) {
    case "price_asc":
      if (c) query = query.or(`price_minor.gt.${c.v},and(price_minor.eq.${c.v},id.gt.${c.id})`);
      query = query.order("price_minor", { ascending: true }).order("id", { ascending: true });
      break;
    case "price_desc":
      if (c) query = query.or(`price_minor.lt.${c.v},and(price_minor.eq.${c.v},id.lt.${c.id})`);
      query = query.order("price_minor", { ascending: false }).order("id", { ascending: false });
      break;
    case "newest":
      if (c) query = query.lt("id", c.id);
      query = query.order("id", { ascending: false });
      break;
    default:
      if (c) query = query.or(`sales_count.lt.${c.v},and(sales_count.eq.${c.v},id.lt.${c.id})`);
      query = query.order("sales_count", { ascending: false }).order("id", { ascending: false });
  }

  const { data, error } = await query.limit(input.limit + 1);
  if (error) throw new Error("Failed to load offers");
  const hasMore = data.length > input.limit;
  const items = data.slice(0, input.limit) as OfferCardDTO[];
  const last = items[items.length - 1];
  const sortVal = (o: OfferCardDTO) =>
    input.sort === "popular" ? o.sales_count : input.sort === "newest" ? o.id : o.price_minor;
  return { items, nextCursor: hasMore && last ? encodeCursor({ v: sortVal(last), id: last.id }) : null };
}

export async function countOffers(categorySlug?: string) {
  const sb = publicClient();
  let q = sb.from("offers").select("id", { count: "exact", head: true }).eq("status", "active");
  if (categorySlug) {
    const { data: cat } = await sb.from("categories").select("id").eq("slug", categorySlug).maybeSingle();
    if (!cat) return 0;
    const { data: ids } = await sb.rpc("category_subtree", { _root: cat.id });
    q = q.in("category_id", (ids ?? []) as string[]);
  }
  const { count } = await q;
  return count ?? 0;
}

export async function getCategoryBySlug(slug: string) {
  const tree = await getCategoryTree();
  const node = flattenTree(tree).find((n) => n.slug === slug);
  if (!node) return null;
  const [count] = await Promise.all([countOffers(slug)]);
  return { category: node, path: categoryPath(tree, node.id), offerCount: count };
}

export async function getOffer(id: number) {
  const sb = publicClient();
  const { data: offer } = await sb
    .from("offers")
    .select(
      "id, slug, title, description, image_url, price_minor, old_price_minor, currency, delivery_type, stock_count, sales_count, region, platform, category_id, seller_id, created_at",
    )
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (!offer) return null;
  const [options, fields, seller, tree] = await Promise.all([
    sb.from("offer_options").select("id, label, price_minor, sort_order").eq("offer_id", id).order("sort_order"),
    sb
      .from("offer_input_fields")
      .select("id, key, label, type, select_options, required, sort_order")
      .eq("offer_id", id)
      .order("sort_order"),
    sb
      .from("seller_profiles")
      .select("user_id, display_name, rating_avg, rating_count, sales_count, verification_status")
      .eq("user_id", offer.seller_id)
      .maybeSingle(),
    getCategoryTree(),
  ]);
  return {
    offer,
    options: options.data ?? [],
    fields: (fields.data ?? []).filter((f) => f.type !== "password"),
    seller: seller.data,
    categoryPath: categoryPath(tree, offer.category_id).map(({ children: _c, ...n }) => n),
  };
}

export async function getSeller(id: string) {
  const { data } = await publicClient()
    .from("seller_profiles")
    .select("user_id, display_name, bio, country, verification_status, rating_avg, rating_count, sales_count, created_at")
    .eq("user_id", id)
    .maybeSingle();
  return data;
}
