import { z } from "zod";

export const sortSchema = z.enum(["popular", "price_asc", "price_desc", "newest"]);
export type OfferSort = z.infer<typeof sortSchema>;

export const slug = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const listOffersSchema = z.object({
  categorySlug: slug.optional(),
  sellerId: uuid.optional(),
  q: z.string().trim().max(100).optional(),
  sort: sortSchema.default("popular"),
  cursor: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(48).default(12),
});
export type ListOffersInput = z.input<typeof listOffersSchema>;

export const offerIdSchema = z.object({ id: z.number().int().positive() });
export const sellerIdSchema = z.object({ id: uuid });
export const categorySlugSchema = z.object({ slug });
export const uuidSchema = uuid;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/[0-9]/, "Include a number");

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema,
});

export const providerSchema = z.enum(["stripe", "paypal", "razorpay", "crypto"]);

export const checkoutSchema = z.object({
  offerId: z.number().int().positive(),
  optionId: uuid.optional(),
  quantity: z.number().int().min(1).max(10).default(1),
  inputs: z.record(z.string().max(40), z.string().max(200)).default({}),
  provider: providerSchema,
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const reviewSchema = z.object({
  orderId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(""),
});

export type OfferCardDTO = {
  id: number;
  slug: string;
  title: string;
  image_url: string | null;
  price_minor: number;
  old_price_minor: number | null;
  currency: string;
  sales_count: number;
};

export type CategoryNode = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  icon: string | null;
  seo_text: string | null;
  sort_order: number;
  show_in_header: boolean;
  children: CategoryNode[];
};
