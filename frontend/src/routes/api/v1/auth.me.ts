import { createFileRoute } from "@tanstack/react-router";
import { authFromRequest, json } from "@/lib/api.server";

// GET /api/v1/auth/me (Bearer token) -> profile + roles
export const Route = createFileRoute("/api/v1/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authFromRequest(request);
        if (!auth) return json({ error: "unauthorized" }, 401);
        const [profile, roles] = await Promise.all([
          auth.sb.from("profiles").select("id, email, status, locale, currency, theme, created_at").eq("id", auth.userId).maybeSingle(),
          auth.sb.from("user_roles").select("role").eq("user_id", auth.userId),
        ]);
        return json(
          { data: { ...profile.data, roles: (roles.data ?? []).map((r) => r.role) } },
          200,
          { "Cache-Control": "no-store" },
        );
      },
    },
  },
});
