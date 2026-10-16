import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as seller from "./seller.server";
import { listSellerOrders } from "./orders.server";
import { requireUser } from "./auth.server";
import type { OfferEditInput } from "./panel.schemas";

const seller_ = () => requireUser("seller");
const offerId = z.object({ id: z.number().int().positive() });

export const fetchSellerDashboard = createServerFn({ method: "GET" }).handler(async () => seller.sellerDashboard(await seller_()));

export const fetchSellerOffers = createServerFn({ method: "GET" }).handler(async () => seller.listSellerOffers(await seller_()));

export const fetchSellerOffer = createServerFn({ method: "GET" })
  .validator((d: { id: number }) => offerId.parse(d))
  .handler(async ({ data }) => seller.getSellerOffer(await seller_(), data.id));

export const saveOfferFn = createServerFn({ method: "POST" })
  .validator((d: OfferEditInput) => d)
  .handler(async ({ data }) => seller.saveOffer(await seller_(), data));

export const archiveOfferFn = createServerFn({ method: "POST" })
  .validator((d: { id: number }) => offerId.parse(d))
  .handler(async ({ data }) => {
    await seller.archiveOffer(await seller_(), data.id);
    return { ok: true };
  });

export const addCodesFn = createServerFn({ method: "POST" })
  .validator((d: { id: number; codes: string[] }) => offerId.extend({ codes: z.array(z.string().max(500)).max(1000) }).parse(d))
  .handler(async ({ data }) => ({ added: await seller.addCodes(await seller_(), data.id, data.codes) }));

export const deleteCodeFn = createServerFn({ method: "POST" })
  .validator((d: { id: number }) => offerId.parse(d))
  .handler(async ({ data }) => {
    await seller.deleteCode(await seller_(), data.id);
    return { ok: true };
  });

export const fetchSellerOrders = createServerFn({ method: "GET" })
  .validator((d: { status?: string }) => z.object({ status: z.enum(["paid", "delivered", "completed", "disputed", "refunded"]).optional() }).parse(d))
  .handler(async ({ data }) => listSellerOrders(await seller_(), data.status));

export const fetchPayouts = createServerFn({ method: "GET" }).handler(async () => seller.listPayouts(await seller_()));

export const requestPayoutFn = createServerFn({ method: "POST" })
  .validator((d: { amount_minor: number; method: string; details: string }) => d)
  .handler(async ({ data }) => {
    await seller.requestPayout(await seller_(), data);
    return { ok: true };
  });

export const fetchMyReviews = createServerFn({ method: "GET" }).handler(async () => seller.listMyReviews(await seller_()));

export const saveSellerProfileFn = createServerFn({ method: "POST" })
  .validator((d: { display_name: string; bio: string; country: string }) => d)
  .handler(async ({ data }) => {
    await seller.saveSellerProfile(await seller_(), data);
    return { ok: true };
  });
