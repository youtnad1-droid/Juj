import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as admin from "./admin.server";
import { requireUser } from "./auth.server";
import type { CategoryEditInput } from "./panel.schemas";

const admin_ = () => requireUser("admin");
const filter = z.object({ q: z.string().max(100).optional(), status: z.string().max(30).optional(), role: z.string().max(10).optional() });
const ok = { ok: true };

export const fetchAdminStats = createServerFn({ method: "GET" }).handler(async () => (await admin_(), admin.adminStats()));

export const fetchAdminUsers = createServerFn({ method: "GET" })
  .validator((d: { q?: string; role?: string }) => filter.parse(d))
  .handler(async ({ data }) => (await admin_(), admin.listUsers(data.q, data.role || undefined)));

export const updateUserFn = createServerFn({ method: "POST" })
  .validator((d: { id: string; role?: string; status?: string; verify?: boolean }) =>
    z.object({
      id: z.string().length(36),
      role: z.enum(["buyer", "seller", "admin"]).optional(),
      status: z.enum(["active", "suspended", "banned"]).optional(),
      verify: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ data }) => {
    const me = await admin_();
    await admin.updateUser(me.id, data.id, data);
    return ok;
  });

export const fetchAdminSellers = createServerFn({ method: "GET" }).handler(async () => (await admin_(), admin.listSellers()));

export const setSellerVerificationFn = createServerFn({ method: "POST" })
  .validator((d: { id: string; status: string }) =>
    z.object({ id: z.string().length(36), status: z.enum(["unverified", "pending", "verified", "rejected"]) }).parse(d))
  .handler(async ({ data }) => (await admin_(), await admin.setSellerVerification(data.id, data.status), ok));

export const fetchAdminCategories = createServerFn({ method: "GET" }).handler(async () => (await admin_(), admin.listCategoriesAdmin()));

export const saveCategoryFn = createServerFn({ method: "POST" })
  .validator((d: CategoryEditInput) => d)
  .handler(async ({ data }) => (await admin_(), admin.saveCategory(data)));

export const deleteCategoryFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string().length(36) }).parse(d))
  .handler(async ({ data }) => (await admin_(), await admin.deleteCategory(data.id), ok));

export const fetchAdminOffers = createServerFn({ method: "GET" })
  .validator((d: { q?: string; status?: string }) => filter.parse(d))
  .handler(async ({ data }) => (await admin_(), admin.listOffersAdmin(data.q, data.status || undefined)));

export const setOfferStatusFn = createServerFn({ method: "POST" })
  .validator((d: { id: number; status: string }) =>
    z.object({ id: z.number().int().positive(), status: z.enum(["draft", "active", "paused", "archived"]) }).parse(d))
  .handler(async ({ data }) => (await admin_(), await admin.setOfferStatus(data.id, data.status), ok));

export const fetchAdminOrders = createServerFn({ method: "GET" })
  .validator((d: { q?: string; status?: string }) => filter.parse(d))
  .handler(async ({ data }) => (await admin_(), admin.listOrdersAdmin(data.status || undefined, data.q || undefined)));

export const resolveOrderFn = createServerFn({ method: "POST" })
  .validator((d: { id: number; action: "refund" | "release" | "cancel" }) =>
    z.object({ id: z.number().int().positive(), action: z.enum(["refund", "release", "cancel"]) }).parse(d))
  .handler(async ({ data }) => (await admin_(), { ok: await admin.resolveOrder(data.id, data.action) }));

export const fetchAdminReviews = createServerFn({ method: "GET" }).handler(async () => (await admin_(), admin.listReviewsAdmin()));

export const setReviewStatusFn = createServerFn({ method: "POST" })
  .validator((d: { id: number; status: "visible" | "hidden" | "delete" }) =>
    z.object({ id: z.number().int().positive(), status: z.enum(["visible", "hidden", "delete"]) }).parse(d))
  .handler(async ({ data }) => (await admin_(), await admin.setReviewStatus(data.id, data.status), ok));

export const fetchAdminPayouts = createServerFn({ method: "GET" }).handler(async () => (await admin_(), admin.listPayoutsAdmin()));

export const processPayoutFn = createServerFn({ method: "POST" })
  .validator((d: { id: number; action: "paid" | "rejected"; note: string }) =>
    z.object({ id: z.number().int().positive(), action: z.enum(["paid", "rejected"]), note: z.string().trim().max(500) }).parse(d))
  .handler(async ({ data }) => (await admin_(), await admin.processPayout(data.id, data.action, data.note), ok));

export const fetchAdminSettings = createServerFn({ method: "GET" }).handler(async () => (await admin_(), admin.adminSettings()));

export const saveSettingsFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => d)
  .handler(async ({ data }) => (await admin_(), await admin.updateSettings(data), ok));

export const retranslateFn = createServerFn({ method: "POST" }).handler(async () => (await admin_(), { queued: await admin.retranslateAll() }));
