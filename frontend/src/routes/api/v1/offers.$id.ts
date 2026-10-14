import { createFileRoute } from "@tanstack/react-router";
import { getOffer } from "@/lib/catalog.server";
import { offerIdSchema } from "@/lib/catalog.schemas";
import { handleError, json } from "@/lib/api.server";

export const Route = createFileRoute("/api/v1/offers/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { id } = offerIdSchema.parse({ id: Number(params.id) });
          const data = await getOffer(id);
          return data ? json({ data }) : json({ error: "not_found" }, 404);
        } catch (e) {
          return handleError(e);
        }
      },
    },
  },
});
