import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addCodesFn, deleteCodeFn } from "@/lib/seller.functions";
import { selectCls } from "./PanelLayout";
import { useI18n } from "@/i18n";

export type OptionRow = { label: string; price: string };
export type FieldRow = { key: string; label: string; type: "text" | "select" | "number"; options: string; required: boolean };

export function OptionsEditor({ rows, onChange }: { rows: OptionRow[]; onChange: (r: OptionRow[]) => void }) {
  const { t } = useI18n();
  const upd = (i: number, p: Partial<OptionRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" data-testid="options-editor">
      <div>
        <h2 className="font-display text-lg font-bold">{t("Options")}</h2>
        <p className="text-xs text-muted-foreground">{t("For example 80 / 160 / 500 Robux. Each option has its own price.")}</p>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <Input placeholder={t("Label")} maxLength={80} value={r.label} onChange={(e) => upd(i, { label: e.target.value })} data-testid={`option-label-${i}`} />
          <Input placeholder="4.99" inputMode="decimal" className="w-28" value={r.price} onChange={(e) => upd(i, { price: e.target.value })} data-testid={`option-price-${i}`} />
          <Button type="button" size="icon" variant="ghost" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" data-testid="add-option" onClick={() => onChange([...rows, { label: "", price: "" }])}><Plus className="h-4 w-4" /> {t("Add option")}</Button>
    </section>
  );
}

export function FieldsEditor({ rows, onChange }: { rows: FieldRow[]; onChange: (r: FieldRow[]) => void }) {
  const { t } = useI18n();
  const upd = (i: number, p: Partial<FieldRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" data-testid="fields-editor">
      <div>
        <h2 className="font-display text-lg font-bold">{t("Buyer input fields")}</h2>
        <p className="text-xs text-muted-foreground">{t("What you need from the buyer, like a username or region. Password fields are not allowed.")}</p>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_110px_auto_auto]">
          <Input placeholder="roblox_username" maxLength={40} value={r.key} onChange={(e) => upd(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} data-testid={`field-key-${i}`} />
          <Input placeholder={t("Label")} maxLength={80} value={r.label} onChange={(e) => upd(i, { label: e.target.value })} data-testid={`field-label-${i}`} />
          <select className={selectCls} value={r.type} onChange={(e) => upd(i, { type: e.target.value as FieldRow["type"] })}>
            <option value="text">{t("Text")}</option><option value="number">{t("Number")}</option><option value="select">{t("Choice")}</option>
          </select>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={r.required} onChange={(e) => upd(i, { required: e.target.checked })} /> {t("Required")}</label>
          <Button type="button" size="icon" variant="ghost" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          {r.type === "select" && (
            <Input className="sm:col-span-5" placeholder={t("Choices, separated by commas")} value={r.options} onChange={(e) => upd(i, { options: e.target.value })} />
          )}
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" data-testid="add-field" onClick={() => onChange([...rows, { key: "", label: "", type: "text", options: "", required: true }])}><Plus className="h-4 w-4" /> {t("Add field")}</Button>
    </section>
  );
}

export function CodesManager({ offerId, codes, onChanged }: { offerId: number; codes: { id: number; code: string }[]; onChanged: () => void }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" data-testid="codes-manager">
      <div>
        <h2 className="font-display text-lg font-bold">{t("Codes for instant delivery")} ({codes.length})</h2>
        <p className="text-xs text-muted-foreground">{t("One code per line. Each sale sends the next code to the buyer automatically.")}</p>
      </div>
      <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="XXXX-XXXX-XXXX" className="font-mono" data-testid="codes-input" />
      <Button size="sm" disabled={busy || !text.trim()} data-testid="codes-add" onClick={async () => {
        setBusy(true);
        try {
          const r = await addCodesFn({ data: { id: offerId, codes: text.split("\n") } });
          toast.success(t("{n} codes added", { n: r.added }));
          setText("");
          onChanged();
        } catch (e) {
          toast.error(t((e as Error).message));
        }
        setBusy(false);
      }}>{t("Add codes")}</Button>
      <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
        {codes.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-3 py-1.5 font-mono text-sm">
            <span className="truncate">{c.code}</span>
            <Button size="icon" variant="ghost" aria-label="Delete" data-testid={`delete-code-${c.id}`} onClick={async () => { await deleteCodeFn({ data: { id: c.id } }); onChanged(); }}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
