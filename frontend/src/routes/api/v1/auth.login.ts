import { createFileRoute } from "@tanstack/react-router";
import { clientIp, loginWithRateLimit } from "@/lib/auth.server";
import { json } from "@/lib/api.server";

// POST /api/v1/auth/login {email, password} -> {access_token, refresh_token}
// Rate limited: 5 failures per email / 20 per IP per 15 minutes.
export const Route = createFileRoute("/api/v1/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const r = await loginWithRateLimit(body, clientIp(request));
        if (r.ok) return json(r, 200, { "Cache-Control": "no-store" });
        return json(r, r.retryAfterSec ? 429 : 401, r.retryAfterSec ? { "Retry-After": String(r.retryAfterSec) } : {});
      },
    },
  },
});
