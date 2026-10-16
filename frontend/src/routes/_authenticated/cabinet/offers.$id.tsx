import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchSellerOffer, saveOfferFn } from "@/lib/seller.functions";
import { fromMinor, toMinor } from "@/lib/money";
import { flatten } from "@/lib/queries";
import { useRootData } from "@/hooks/useAuth";
import { PageTitle, selectCls } from "@/components/site/PanelLayout";
import { OptionsEditor, FieldsEditor, CodesManager, type FieldRow, type OptionRow } from "@/components/site/OfferEditorParts";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/cabinet/offers/$id")({
  head: () => ({ meta: [{ title: "Edit offer — JUJ" }] }),
  component: Page,
});

const STOCK_IMAGES = ["robux", "giftcard", "topup", "limited", "console", "game", "software", "subscription"].map((n) => `/images/offers/${n}.jpg`);
const blank = { title: "", description: "", category_id: "", image_url: STOCK_IMAGES[0], price: "", old_price: "", delivery_type: "auto_codes" as "auto_codes" | "manual", stock_count: "0", status: "active" as "draft" | "active" | "paused", region: "", platform: "" };

function Page() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const offerId = isNew ? 0 : Number(id);
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { tree } = useRootData();
  const cats = flatten(tree);
  const q = useQuery({ queryKey: ["seller-offer", offerId], queryFn: () => fetchSellerOffer({ data: { id: offerId } }), enabled: !isNew });
  const [f, setF] = useState(blank);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = q.data;
    if (!d?.offer) return;
    const o = d.offer as Record<string, string | number | null>;
    setF({
      title: String(o.title), description: String(o.description ?? ""), category_id: String(o.category_id), image_url: String(o.image_url ?? ""),
      price: fromMinor(Number(o.price_minor)), old_price: fromMinor(o.old_price_minor as number | null), delivery_type: o.delivery_type as "manual",
      stock_count: String(o.stock_count), status: (o.status === "archived" ? "paused" : o.status) as "active", region: String(o.region ?? ""), platform: String(o.platform ?? ""),
    });
    setOptions(d.options.map((x) => ({ label: x.label, price: fromMinor(x.price_minor) })));
    setFields(d.fields.map((x) => ({ key: x.key, label: x.label, type: x.type as FieldRow["type"], options: x.select_options.join(", "), required: x.required })));
  }, [q.data]);

  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = toMinor(f.price);
    const old = f.old_price.trim() ? toMinor(f.old_price) : null;
    const opts = options.map((o) => ({ label: o.label, price_minor: toMinor(o.price) }));
    if (Number.isNaN(price) || (old !== null && Number.isNaN(old)) || opts.some((o) => Number.isNaN(o.price_minor))) return toast.error(t("Enter prices like 4.99"));
    setBusy(true);
    try {
      const r = await saveOfferFn({
        data: {
          id: isNew ? undefined : offerId, title: f.title, description: f.description, category_id: f.category_id, image_url: f.image_url,
          price_minor: price, old_price_minor: old, delivery_type: f.delivery_type, stock_count: Number(f.stock_count) || 0, status: f.status,
          region: f.region, platform: f.platform, options: opts,
          fields: fields.map((x) => ({ key: x.key, label: x.label, type: x.type, required: x.required, select_options: x.options.split(",").map((s) => s.trim()).filter(Boolean) })),
        },
      });
      toast.success(t("Offer saved. Translations update in a minute."));
      qc.invalidateQueries({ queryKey: ["seller-offers"] });
      if (isNew) navigate({ to: "/cabinet/offers/$id", params: { id: String(r.id) } });
      else qc.invalidateQueries({ queryKey: ["seller-offer", offerId] });
    } catch (err) {
      toast.error(t((err as Error).message.split("\n")[0]));
    }
    setBusy(false);
  };

  if (!isNew && q.isPending) return <p className="text-muted-foreground">{t("Loading…")}</p>;
  return (
    <>
      <PageTitle>{isNew ? t("New offer") : t("Edit offer")}</PageTitle>
      <form onSubmit={save} className="space-y-5" data-testid="offer-editor-form">
        <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2"><Label>{t("Title")}</Label><Input required minLength={3} maxLength={160} value={f.title} onChange={set("title")} data-testid="offer-title-input" /></div>
          <div className="space-y-1 md:col-span-2"><Label>{t("Description")}</Label><Textarea rows={5} maxLength={8000} value={f.description} onChange={set("description")} data-testid="offer-description-input" /></div>
          <div className="space-y-1">
            <Label>{t("Category")}</Label>
            <select required className={`${selectCls} w-full`} value={f.category_id} onChange={set("category_id")} data-testid="offer-category-select">
              <option value="">—</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>{t("Status")}</Label>
            <select className={`${selectCls} w-full`} value={f.status} onChange={set("status")} data-testid="offer-status-select">
              <option value="active">{t("Active")}</option><option value="paused">{t("Paused")}</option><option value="draft">{t("Draft")}</option>
            </select>
          </div>
          <div className="space-y-1"><Label>{t("Price (USD)")}</Label><Input required inputMode="decimal" placeholder="4.99" value={f.price} onChange={set("price")} data-testid="offer-price-input" /></div>
          <div className="space-y-1"><Label>{t("Old price (optional)")}</Label><Input inputMode="decimal" value={f.old_price} onChange={set("old_price")} data-testid="offer-old-price-input" /></div>
          <div className="space-y-1">
            <Label>{t("Delivery")}</Label>
            <select className={`${selectCls} w-full`} value={f.delivery_type} onChange={set("delivery_type")} data-testid="offer-delivery-select">
              <option value="auto_codes">{t("Instant codes")}</option><option value="manual">{t("Seller delivers by hand")}</option>
            </select>
          </div>
          <div className="space-y-1"><Label>{t("Stock")}</Label><Input type="number" min={0} value={f.stock_count} onChange={set("stock_count")} data-testid="offer-stock-input" /></div>
          <div className="space-y-1"><Label>{t("Region")}</Label><Input maxLength={40} value={f.region} onChange={set("region")} data-testid="offer-region-input" /></div>
          <div className="space-y-1"><Label>{t("Platform")}</Label><Input maxLength={60} value={f.platform} onChange={set("platform")} data-testid="offer-platform-input" /></div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t("Image")}</Label>
            <div className="flex flex-wrap gap-2">
              {STOCK_IMAGES.map((src) => (
                <button type="button" key={src} onClick={() => setF({ ...f, image_url: src })} className={`h-14 w-14 overflow-hidden rounded-lg border-2 ${f.image_url === src ? "border-primary" : "border-transparent"}`}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <Input placeholder="https://…" value={f.image_url} onChange={set("image_url")} data-testid="offer-image-input" />
          </div>
        </div>
        <OptionsEditor rows={options} onChange={setOptions} />
        <FieldsEditor rows={fields} onChange={setFields} />
        <Button disabled={busy} data-testid="offer-save-button">{busy ? t("Saving…") : t("Save offer")}</Button>
      </form>
      {!isNew && f.delivery_type === "auto_codes" && q.data && (
        <CodesManager offerId={offerId} codes={q.data.codes} onChanged={() => { qc.invalidateQueries({ queryKey: ["seller-offer", offerId] }); qc.invalidateQueries({ queryKey: ["seller-offers"] }); }} />
      )}
    </>
  );
}
