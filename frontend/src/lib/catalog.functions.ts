import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { queryOptions } from "@tanstack/react-query";
import {
  categorySlugSchema,
  listOffersSchema,
  offerIdSchema,
  sellerIdSchema,
  type ListOffersInput,
} from "./catalog.schemas";
import * as catalog from "./catalog.server";
import { clientIp, loginWithRateLimit } from "./auth.server";

export const fetchCategoryTree = createServerFn({ method: "GET" }).handler(() => catalog.getCategoryTree());

export const fetchOffers = createServerFn({ method: "GET" })
  .inputValidator((d: ListOffersInput) => listOffersSchema.parse(d))
  .handler(({ data }) => catalog.listOffers(data));

export const fetchCategory = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => categorySlugSchema.parse(d))
  .handler(({ data }) => catalog.getCategoryBySlug(data.slug));

export const fetchOffer = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => offerIdSchema.parse(d))
  .handler(({ data }) => catalog.getOffer(data.id));

export const fetchSeller = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => sellerIdSchema.parse(d))
  .handler(({ data }) => catalog.getSeller(data.id));

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(({ data }) => loginWithRateLimit(data, clientIp(getRequest())));

export const categoryTreeQuery = () =>
  queryOptions({ queryKey: ["categories"], queryFn: () => fetchCategoryTree(), staleTime: 5 * 60_000 });
