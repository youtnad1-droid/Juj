import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listOffers } from "@/lib/catalog.server";
import { listOffersSchema } from "@/lib/catalog.schemas";
import { handleError, json } from "@/lib/api.server";

// GET /api/v1/search?q=robux&category=roblox&sort=&cursor=
export const Route = createFileRoute("/api/v1/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const p = new URL(request.url).searchParams;
          const q = z.string().trim().min(1).max(100).parse(p.get("q") ?? "");
          const input = listOffersSchema.parse({
            q,
            categorySlug: p.get("category") || undefined,
            sort: p.get("sort") ?? undefined,
            cursor: p.get("cursor") ?? undefined,
          });
          return json(await listOffers(input));
        } catch (e) {
          return handleError(e);
        }
      },
    },
  },
});
