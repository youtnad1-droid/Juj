import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Start selling — JUJ" },
      { name: "description", content: "Sell digital goods to buyers worldwide on JUJ." },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold">{t("Start selling on JUJ")}</h1>
      {user?.role === "seller" ? (
        <Button asChild className="mt-6" data-testid="sell-open-cabinet"><Link to="/cabinet">{t("Open seller cabinet")}</Link></Button>
      ) : (
        <p className="mt-4 text-muted-foreground">{t("New seller accounts open soon. Questions? Write to support@juj.gg.")}</p>
      )}
    </div>
  );
}
