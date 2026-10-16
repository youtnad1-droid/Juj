import { createFileRoute } from "@tanstack/react-router";
import { verifyNowPayments } from "@/lib/payments.server";
import { paymentNotified } from "@/lib/orders.server";

export const Route = createFileRoute("/api/payments/crypto/ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { invoice_id?: number | string; payment_status?: string } | null;
        if (!body || !verifyNowPayments(body, request.headers.get("x-nowpayments-sig") ?? "")) return Response.json({ error: "bad_signature" }, { status: 400 });
        const st = body.payment_status === "finished" || body.payment_status === "confirmed" ? "paid" : body.payment_status === "failed" || body.payment_status === "expired" ? "failed" : "pending";
        if (body.invoice_id) await paymentNotified("crypto", String(body.invoice_id), st);
        return Response.json({ ok: true });
      },
    },
  },
});
