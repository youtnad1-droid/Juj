import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchSellerOrders } from "@/lib/seller.functions";
import { fmtDate, formatPrice } from "@/lib/money";
import { PageTitle, selectCls } from "@/components/site/PanelLayout";
import { StatusBadge, orderStatusLabel } from "@/components/site/StatusBadge";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/cabinet/orders")({
  head: () => ({ meta: [{ title: "Seller orders — JUJ" }] }),
  component: Page,
});

const STATUSES = ["paid", "delivered", "completed", "disputed", "refunded"] as const;

function Page() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<(typeof STATUSES)[number] | "">("");
  const q = useQuery({ queryKey: ["seller-orders", status], queryFn: () => fetchSellerOrders({ data: { status: status || undefined } }) });
  return (
    <>
      <PageTitle action={
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} data-testid="seller-orders-filter">
          <option value="">{t("All")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{orderStatusLabel(t, s)}</option>)}
        </select>
      }>{t("Orders")}</PageTitle>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table data-testid="seller-orders-table">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead><TableHead>{t("Offer")}</TableHead><TableHead>{t("Total")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead>{t("Date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell><Link to="/orders/$id" params={{ id: String(o.id) }} className="font-semibold underline" data-testid={`seller-order-${o.id}`}>#{o.id}</Link></TableCell>
                <TableCell className="max-w-xs truncate">{o.offer_title}{o.option_label ? ` — ${o.option_label}` : ""} ×{o.quantity}</TableCell>
                <TableCell>{formatPrice(o.total_minor, o.currency)}</TableCell>
                <TableCell><StatusBadge status={o.status} /></TableCell>
                <TableCell className="whitespace-nowrap text-xs">{fmtDate(o.created_at, locale, true)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {q.data && !q.data.length && <p className="p-8 text-center text-muted-foreground">{t("No orders yet.")}</p>}
      </div>
    </>
  );
}
