import { createFileRoute } from "@tanstack/react-router";
import { stripeEvent } from "@/lib/payments.server";
import { paymentNotified } from "@/lib/orders.server";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ev = stripeEvent(await request.text(), request.headers.get("stripe-signature") ?? "");
          const s = ev.data.object as { id: string; payment_status?: string };
          if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
            if (s.payment_status === "paid") await paymentNotified("stripe", s.id, "paid");
          } else if (ev.type === "checkout.session.expired" || ev.type === "checkout.session.async_payment_failed") {
            await paymentNotified("stripe", s.id, "failed");
          }
          return Response.json({ status: "ok" });
        } catch {
          return Response.json({ error: "invalid_signature" }, { status: 400 });
        }
      },
    },
  },
});
