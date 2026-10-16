import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { archiveOfferFn, fetchSellerOffers } from "@/lib/seller.functions";
import { formatPrice, offerPath } from "@/lib/money";
import { PageTitle } from "@/components/site/PanelLayout";
import { StatusBadge } from "@/components/site/StatusBadge";
import { ConfirmButton } from "@/components/site/ConfirmButton";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/cabinet/offers/")({
  head: () => ({ meta: [{ title: "My offers — JUJ" }] }),
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["seller-offers"], queryFn: () => fetchSellerOffers() });
  return (
    <>
      <PageTitle action={<Button asChild size="sm" data-testid="new-offer-button"><Link to="/cabinet/offers/$id" params={{ id: "new" }}><Plus className="h-4 w-4" /> {t("New offer")}</Link></Button>}>
        {t("My offers")}
      </PageTitle>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table data-testid="seller-offers-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t("Offer")}</TableHead>
              <TableHead>{t("Price")}</TableHead>
              <TableHead>{t("Stock")}</TableHead>
              <TableHead>{t("Sold")}</TableHead>
              <TableHead>{t("Status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((o) => (
              <TableRow key={o.id} data-testid={`seller-offer-row-${o.id}`}>
                <TableCell className="max-w-xs">
                  <Link to="/catalog/product/$offer" params={{ offer: offerPath(o.slug, o.id) }} className="line-clamp-1 font-medium hover:underline">{o.title}</Link>
                  <span className="text-xs text-muted-foreground">{o.delivery_type === "auto_codes" ? t("{n} codes ready", { n: o.codes }) : t("Manual delivery")}</span>
                </TableCell>
                <TableCell>{formatPrice(o.price_minor, o.currency)}</TableCell>
                <TableCell>{o.stock_count}</TableCell>
                <TableCell>{o.sales_count}</TableCell>
                <TableCell><StatusBadge status={o.status} /></TableCell>
                <TableCell className="whitespace-nowrap text-end">
                  <Button asChild size="icon" variant="ghost" aria-label="Edit"><Link to="/cabinet/offers/$id" params={{ id: String(o.id) }} data-testid={`edit-offer-${o.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                  <ConfirmButton testId={`archive-offer-${o.id}`} question={t("Archive this offer? Buyers won't see it anymore.")} onConfirm={async () => {
                    await archiveOfferFn({ data: { id: o.id } });
                    toast.success(t("Offer archived"));
                    qc.invalidateQueries({ queryKey: ["seller-offers"] });
                  }}><Archive className="h-4 w-4" /></ConfirmButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {q.data && !q.data.length && <p className="p-8 text-center text-muted-foreground">{t("No offers yet.")}</p>}
      </div>
    </>
  );
}
