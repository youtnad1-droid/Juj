import { createFileRoute } from "@tanstack/react-router";
import { authFromRequest, handleError, json } from "@/lib/api.server";
import { offerIdSchema } from "@/lib/catalog.schemas";

// Requires Authorization: Bearer <access token>
// GET  /api/v1/favorites            -> list
// POST /api/v1/favorites {offerId}  -> add
export const Route = createFileRoute("/api/v1/favorites")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authFromRequest(request);
        if (!auth) return json({ error: "unauthorized" }, 401);
        const { data, error } = await auth.sb
          .from("favorites")
          .select("created_at, offer:offers(id, slug, title, image_url, price_minor, old_price_minor, currency, sales_count)")
          .order("created_at", { ascending: false });
        if (error) return handleError(error);
        return json({ data: data.map((f) => f.offer).filter(Boolean) }, 200, { "Cache-Control": "no-store" });
      },
      POST: async ({ request }) => {
        try {
          const auth = await authFromRequest(request);
          if (!auth) return json({ error: "unauthorized" }, 401);
          const body = (await request.json().catch(() => ({}))) as { offerId?: unknown };
          const { id } = offerIdSchema.parse({ id: body.offerId });
          const { error } = await auth.sb.from("favorites").upsert({ user_id: auth.userId, offer_id: id });
          if (error) return json({ error: "cannot_add" }, 400);
          return json({ ok: true }, 201);
        } catch (e) {
          return handleError(e);
        }
      },
    },
  },
});
