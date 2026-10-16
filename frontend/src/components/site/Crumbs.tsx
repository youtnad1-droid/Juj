import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";

export function Crumbs({ path, last }: { path: { id: string; slug: string; name: string }[]; last?: string }) {
  const { t } = useI18n();
  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumbs" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <Link to="/" className="hover:text-foreground">{t("Home")}</Link>
      {path.map((c) => (
        <span key={c.id} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <Link to="/catalog/$categorySlug" params={{ categorySlug: c.slug }} className="hover:text-foreground">{c.name}</Link>
        </span>
      ))}
      {last && (
        <span className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <span className="line-clamp-1 text-foreground">{last}</span>
        </span>
      )}
    </nav>
  );
}
