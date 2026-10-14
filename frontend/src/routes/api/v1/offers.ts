import { createFileRoute } from "@tanstack/react-router";
import { listOffers } from "@/lib/catalog.server";
import { listOffersSchema } from "@/lib/catalog.schemas";
import { handleError, json } from "@/lib/api.server";

// GET /api/v1/offers?category=&seller=&q=&sort=popular|price_asc|price_desc|newest&cursor=&limit=
export const Route = createFileRoute("/api/v1/offers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const p = new URL(request.url).searchParams;
          const input = listOffersSchema.parse({
            categorySlug: p.get("category") ?? undefined,
            sellerId: p.get("seller") ?? undefined,
            q: p.get("q") ?? undefined,
            sort: p.get("sort") ?? undefined,
            cursor: p.get("cursor") ?? undefined,
            limit: p.get("limit") ? Number(p.get("limit")) : undefined,
          });
          return json(await listOffers(input));
        } catch (e) {
          return handleError(e);
        }
      },
    },
  },
});
