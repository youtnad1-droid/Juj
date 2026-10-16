import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyEmailFn } from "@/lib/catalog.functions";
import { useRefreshSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  validateSearch: z.object({ token: z.string().max(200).catch("") }),
  head: () => ({ meta: [{ title: "Confirm email — JUJ" }] }),
  component: Page,
});

function Page() {
  const { token } = Route.useSearch();
  const refresh = useRefreshSession();
  const { t } = useI18n();
  const [state, setState] = useState<"busy" | "ok" | string>("busy");
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    verifyEmailFn({ data: { token } })
      .then(async (r) => {
        if (r.ok) await refresh();
        setState(r.ok ? "ok" : r.error);
      })
      .catch(() => setState("This link is invalid or expired."));
  }, [token, refresh]);
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center" data-testid="verify-email-page">
      {state === "busy" ? (
        <p className="text-muted-foreground">{t("Confirming your email…")}</p>
      ) : state === "ok" ? (
        <div className="space-y-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold">{t("Your email is confirmed")}</h1>
          <Button asChild><Link to="/">{t("Start shopping")}</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-2xl font-bold">{t(state)}</h1>
          <Button asChild variant="secondary"><Link to="/auth">{t("Log in")}</Link></Button>
        </div>
      )}
    </div>
  );
}
