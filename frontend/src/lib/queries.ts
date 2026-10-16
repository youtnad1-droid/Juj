import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchFavorites, fetchOffers } from "./catalog.functions";
import type { CategoryNode, OfferSort } from "./catalog.schemas";
import type { SessionUser } from "./auth.server";
import type { Locale } from "@/i18n/locales";

export type RootData = { tree: CategoryNode[]; session: { user: SessionUser | null; locale: Locale } };
export type OfferFilter = { categorySlug?: string | undefined; sellerId?: string; q?: string; sort?: OfferSort };

export const offersInfiniteQuery = (f: OfferFilter) =>
  infiniteQueryOptions({
    queryKey: ["offers", f],
    queryFn: ({ pageParam }) => fetchOffers({ data: { ...f, sort: f.sort ?? "popular", cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const favoritesQuery = (userId: string | undefined) =>
  queryOptions({ queryKey: ["favorites", userId], enabled: !!userId, queryFn: () => fetchFavorites() });

export function flatten(tree: CategoryNode[]): CategoryNode[] {
  return tree.flatMap((n) => [n, ...flatten(n.children)]);
}
