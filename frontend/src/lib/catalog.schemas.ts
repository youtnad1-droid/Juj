import { z } from "zod";

export const sortSchema = z.enum(["popular", "price_asc", "price_desc", "newest"]);
export type OfferSort = z.infer<typeof sortSchema>;

const slug = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const listOffersSchema = z.object({
  categorySlug: slug.optional(),
  sellerId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  sort: sortSchema.default("popular"),
  cursor: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(48).default(12),
});
export type ListOffersInput = z.input<typeof listOffersSchema>;

export const offerIdSchema = z.object({ id: z.number().int().positive() });
export const sellerIdSchema = z.object({ id: z.string().uuid() });
export const categorySlugSchema = z.object({ slug });

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
