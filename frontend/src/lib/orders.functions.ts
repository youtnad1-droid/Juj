import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkoutSchema, reviewSchema, type CheckoutInput } from "./catalog.schemas";
import * as orders from "./orders.server";
import { requireUser } from "./auth.server";

const idOnly = z.object({ orderId: z.number().int().positive() });

export const checkoutFn = createServerFn({ method: "POST" })
  .validator((d: CheckoutInput) => checkoutSchema.parse(d))
  .handler(async ({ data }) => orders.createOrder(await requireUser(), data));

export const retryPaymentFn = createServerFn({ method: "POST" })
  .validator((d: { orderId: number }) => idOnly.parse(d))
  .handler(async ({ data }) => orders.retryPayment(await requireUser(), data.orderId));

export const confirmCheckoutFn = createServerFn({ method: "POST" })
  .validator((d: { orderId: number }) => idOnly.parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const d = await orders.getOrderDetail(user, data.orderId);
    if (!d || d.role !== "buyer") return { status: null };
    return { status: await orders.confirmPayment(data.orderId) };
  });

export const fetchMyOrders = createServerFn({ method: "GET" }).handler(async () => orders.listBuyerOrders(await requireUser()));

export const fetchOrder = createServerFn({ method: "GET" })
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => orders.getOrderDetail(await requireUser(), data.id));

export const sendMessageFn = createServerFn({ method: "POST" })
  .validator((d: { orderId: number; body: string; deliver?: boolean }) =>
    idOnly.extend({ body: z.string().trim().min(1).max(4000), deliver: z.boolean().default(false) }).parse(d))
  .handler(async ({ data }) => {
    await orders.postMessage(await requireUser(), data.orderId, data.body, data.deliver);
    return { ok: true };
  });

export const confirmReceivedFn = createServerFn({ method: "POST" })
  .validator((d: { orderId: number }) => idOnly.parse(d))
  .handler(async ({ data }) => {
    await orders.confirmReceived(await requireUser(), data.orderId);
    return { ok: true };
  });

export const disputeFn = createServerFn({ method: "POST" })
  .validator((d: { orderId: number; reason: string }) => idOnly.extend({ reason: z.string().trim().min(5).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    await orders.openDispute(await requireUser(), data.orderId, data.reason);
    return { ok: true };
  });

export const reviewFn = createServerFn({ method: "POST" })
  .validator((d: { orderId: number; rating: number; comment: string }) => reviewSchema.parse(d))
  .handler(async ({ data }) => {
    await orders.leaveReview(await requireUser(), data);
    return { ok: true };
  });

export const replyReviewFn = createServerFn({ method: "POST" })
  .validator((d: { orderId: number; reply: string }) => idOnly.extend({ reply: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    await orders.replyToReview(await requireUser("seller"), data.orderId, data.reply);
    return { ok: true };
  });
