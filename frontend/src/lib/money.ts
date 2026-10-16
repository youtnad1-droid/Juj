/** Money is always stored as integer minor units (cents). */
export function formatPrice(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

/** Sales count buckets: "100+", "1 000+", exact above 10 000. */
export function salesBucket(n: number): string | null {
  if (n > 10_000) return n.toLocaleString("en-US").replace(/,/g, " ");
  const steps = [5000, 1000, 500, 100, 50, 10];
  for (const s of steps) if (n >= s) return `${s.toLocaleString("en-US").replace(/,/g, " ")}+`;
  return n > 0 ? String(n) : null;
}

export function offerPath(slug: string, id: number) {
  return `${slug}-${id}`;
}

export function parseOfferParam(param: string): number | null {
  const m = /-(\d+)$/.exec(param) ?? /^(\d+)$/.exec(param);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const fmtDate = (d: Date | string | null | undefined, locale: string, time = false) =>
  d ? new Date(d).toLocaleString(locale, time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "—";

/** "12.50" -> 1250 cents; returns NaN for bad input. */
export const toMinor = (v: string) => (/^\d+(\.\d{1,2})?$/.test(v.trim()) ? Math.round(Number(v) * 100) : NaN);
export const fromMinor = (n: number | null | undefined) => (n == null ? "" : (n / 100).toFixed(2));
