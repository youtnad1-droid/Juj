import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchOffers } from "./catalog.functions";
import type { CategoryNode, OfferSort } from "./catalog.schemas";
import { supabase } from "@/integrations/supabase/client";
import type { OfferCardDTO } from "./catalog.schemas";

export type OfferFilter = { categorySlug?: string | undefined; sellerId?: string; q?: string; sort?: OfferSort };

export const offersInfiniteQuery = (f: OfferFilter) =>
  infiniteQueryOptions({
    queryKey: ["offers", f],
    queryFn: ({ pageParam }) => fetchOffers({ data: { ...f, sort: f.sort ?? "popular", cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const favoritesQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["favorites", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("created_at, offer:offers(id, slug, title, image_url, price_minor, old_price_minor, currency, sales_count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((f) => f.offer).filter(Boolean) as OfferCardDTO[];
    },
  });

export function flatten(tree: CategoryNode[]): CategoryNode[] {
  return tree.flatMap((n) => [n, ...flatten(n.children)]);
}
