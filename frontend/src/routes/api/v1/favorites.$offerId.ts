import { createFileRoute } from "@tanstack/react-router";
import { authFromRequest, handleError, json } from "@/lib/api.server";
import { offerIdSchema } from "@/lib/catalog.schemas";

// DELETE /api/v1/favorites/:offerId (auth required)
export const Route = createFileRoute("/api/v1/favorites/$offerId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const auth = await authFromRequest(request);
          if (!auth) return json({ error: "unauthorized" }, 401);
          const { id } = offerIdSchema.parse({ id: Number(params.offerId) });
          await auth.sb.from("favorites").delete().eq("user_id", auth.userId).eq("offer_id", id);
          return json({ ok: true });
        } catch (e) {
          return handleError(e);
        }
      },
    },
  },
});
