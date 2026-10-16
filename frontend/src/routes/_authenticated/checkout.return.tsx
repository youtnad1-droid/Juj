import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { confirmCheckoutFn } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/checkout/return")({
  validateSearch: z.object({ order: z.coerce.number().int().positive().catch(0) }),
  head: () => ({ meta: [{ title: "Confirming payment — JUJ" }] }),
  component: Page,
});

function Page() {
  const { order } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop || !order) return;
      const r = await confirmCheckoutFn({ data: { orderId: order } }).catch(() => ({ status: null }));
      if (r.status && r.status !== "pending_payment") {
        navigate({ to: "/orders/$id", params: { id: String(order) }, replace: true });
        return;
      }
      if (++tries >= 20) return setWaiting(false);
      setTimeout(tick, 3000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [order, navigate]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center" data-testid="checkout-return">
      {waiting ? (
        <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <h1 className="mt-4 text-2xl font-bold">{t("Confirming your payment…")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("This usually takes a few seconds. Crypto payments can take longer.")}</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">{t("We're still waiting for the payment")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("You can check the order page later — it updates on its own.")}</p>
          <Button asChild className="mt-6"><Link to="/orders/$id" params={{ id: String(order) }}>{t("Open order")}</Link></Button>
        </>
      )}
    </div>
  );
}
