import { z } from "zod";
import { slug, uuidSchema } from "./catalog.schemas";

const minor = z.number().int().min(0).max(100_000_000);

export const offerEditSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(8000).default(""),
  category_id: uuidSchema,
  image_url: z.string().trim().max(500).regex(/^(https:\/\/|\/)/, "Use an https:// link or a /images path").or(z.literal("")).default(""),
  price_minor: minor.min(1),
  old_price_minor: minor.nullable().default(null),
  delivery_type: z.enum(["auto_codes", "manual"]),
  stock_count: z.number().int().min(0).max(1_000_000),
  status: z.enum(["draft", "active", "paused"]),
  region: z.string().trim().max(40).default(""),
  platform: z.string().trim().max(60).default(""),
  options: z.array(z.object({ label: z.string().trim().min(1).max(80), price_minor: minor.min(1) })).max(30).default([]),
  fields: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/).refine((k) => !/pass|pwd|secret/i.test(k), "Password fields are not allowed"),
        label: z.string().trim().min(1).max(80).refine((l) => !/password/i.test(l), "Password fields are not allowed"),
        type: z.enum(["text", "select", "number"]),
        select_options: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
        required: z.boolean().default(true),
      }),
    )
    .max(10)
    .default([]),
});
export type OfferEditInput = z.input<typeof offerEditSchema>;

export const categoryEditSchema = z.object({
  id: uuidSchema.optional(),
  parent_id: uuidSchema.nullable(),
  slug,
  name: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(60).default(""),
  seo_text: z.string().trim().max(2000).default(""),
  commission_percent: z.number().min(0).max(100),
  sort_order: z.number().int().min(0).max(10000),
  show_in_header: z.boolean(),
  is_active: z.boolean(),
});
export type CategoryEditInput = z.input<typeof categoryEditSchema>;

export const payoutRequestSchema = z.object({
  amount_minor: z.number().int().min(100).max(100_000_000),
  method: z.enum(["bank", "paypal", "crypto", "other"]),
  details: z.string().trim().min(3).max(500),
});

export const settingsSchema = z.object({
  site_name: z.string().trim().min(1).max(60),
  support_email: z.string().trim().email().max(254),
  auto_complete_hours: z.number().int().min(1).max(720),
  payment_methods: z.object({ stripe: z.boolean(), paypal: z.boolean(), razorpay: z.boolean(), crypto: z.boolean() }),
});

export const sellerProfileSchema = z.object({
  display_name: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(2000).default(""),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).or(z.literal("")).default(""),
});
