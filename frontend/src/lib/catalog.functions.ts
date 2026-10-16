import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { categorySlugSchema, listOffersSchema, offerIdSchema, sellerIdSchema, type ListOffersInput } from "./catalog.schemas";
import * as catalog from "./catalog.server";
import * as auth from "./auth.server";
import { availableMethods } from "./orders.server";
import { requestLocale } from "@/i18n/locale.server";

const emailOnly = z.object({ email: z.string().trim().max(254) });
const tokenOnly = z.object({ token: z.string().min(10).max(200) });

export const fetchSession = createServerFn({ method: "GET" }).handler(async () => ({
  user: await auth.currentUser(),
  locale: requestLocale(),
}));

export const fetchCategoryTree = createServerFn({ method: "GET" }).handler(() => catalog.getCategoryTree(requestLocale()));

export const fetchOffers = createServerFn({ method: "GET" })
  .validator((d: ListOffersInput) => listOffersSchema.parse(d))
  .handler(({ data }) => catalog.listOffers(data, requestLocale()));

export const fetchCategory = createServerFn({ method: "GET" })
  .validator((d: { slug: string }) => categorySlugSchema.parse(d))
  .handler(({ data }) => catalog.getCategoryBySlug(data.slug, requestLocale()));

export const fetchOffer = createServerFn({ method: "GET" })
  .validator((d: { id: number }) => offerIdSchema.parse(d))
  .handler(async ({ data }) => {
    const offer = await catalog.getOffer(data.id, requestLocale());
    return offer ? { ...offer, methods: await availableMethods() } : null;
  });

export const fetchSeller = createServerFn({ method: "GET" })
  .validator((d: { id: string }) => sellerIdSchema.parse(d))
  .handler(async ({ data }) => {
    const seller = await catalog.getSeller(data.id);
    return seller ? { seller, reviews: await catalog.getSellerReviews(data.id, requestLocale()) } : null;
  });

export const loginFn = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const r = await auth.login(data, auth.clientIp(getRequest()));
    if (!r.ok) return r;
    await auth.startSession(r.userId);
    return { ok: true as const, role: (await auth.loadUser(r.userId))?.role ?? "buyer" };
  });

export const registerFn = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) => d)
  .handler(({ data }) => auth.register(data));

export const logoutFn = createServerFn({ method: "POST" }).handler(() => {
  auth.endSession();
  return { ok: true };
});

export const verifyEmailFn = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => tokenOnly.parse(d))
  .handler(({ data }) => auth.verifyEmail(data.token));

export const resendVerificationFn = createServerFn({ method: "POST" })
  .validator((d: { email: string }) => emailOnly.parse(d))
  .handler(({ data }) => auth.resendVerification(data.email));

export const forgotPasswordFn = createServerFn({ method: "POST" })
  .validator((d: { email: string }) => emailOnly.parse(d))
  .handler(({ data }) => auth.forgotPassword(data.email));

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator((d: { token: string; password: string }) => tokenOnly.extend({ password: z.string().max(128) }).parse(d))
  .handler(({ data }) => auth.resetPassword(data.token, data.password));

export const fetchFavorites = createServerFn({ method: "GET" }).handler(async () => {
  const user = await auth.currentUser();
  return user ? catalog.listFavorites(user.id, requestLocale()) : [];
});

export const setFavoriteFn = createServerFn({ method: "POST" })
  .validator((d: { offerId: number; on: boolean }) => z.object({ offerId: z.number().int().positive(), on: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const user = await auth.requireUser();
    await catalog.setFavorite(user.id, data.offerId, data.on);
    return { ok: true };
  });

export const categoryTreeQuery = () =>
  queryOptions({ queryKey: ["categories"], queryFn: () => fetchCategoryTree(), staleTime: 5 * 60_000 });

export const sessionQuery = () =>
  queryOptions({ queryKey: ["session"], queryFn: () => fetchSession(), staleTime: 5 * 60_000 });
