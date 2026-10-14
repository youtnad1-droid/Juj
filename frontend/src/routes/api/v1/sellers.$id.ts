import { createFileRoute } from "@tanstack/react-router";
import { getSeller, listOffers } from "@/lib/catalog.server";
import { sellerIdSchema } from "@/lib/catalog.schemas";
import { handleError, json } from "@/lib/api.server";

export const Route = createFileRoute("/api/v1/sellers/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { id } = sellerIdSchema.parse(params);
          const seller = await getSeller(id);
          if (!seller) return json({ error: "not_found" }, 404);
          const offers = await listOffers({ sellerId: id, limit: 24 });
          return json({ data: { seller, offers } });
        } catch (e) {
          return handleError(e);
        }
      },
    },
  },
});
