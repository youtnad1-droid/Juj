import { createFileRoute } from "@tanstack/react-router";
import { getCategoryTree } from "@/lib/catalog.server";
import { handleError, json } from "@/lib/api.server";

export const Route = createFileRoute("/api/v1/categories")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json({ data: await getCategoryTree() }, 200, { "Cache-Control": "public, max-age=60" });
        } catch (e) {
          return handleError(e);
        }
      },
    },
  },
});
