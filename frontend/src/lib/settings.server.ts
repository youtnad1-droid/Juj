import { exec, rows } from "./db.server";

export const PROVIDERS = ["stripe", "paypal", "razorpay", "crypto"] as const;
export type Provider = (typeof PROVIDERS)[number];
export type Settings = {
  site_name: string;
  support_email: string;
  auto_complete_hours: number;
  payment_methods: Record<Provider, boolean>;
};

export async function getSettings(): Promise<Settings> {
  const data = Object.fromEntries(
    (await rows<{ setting_key: string; value: string }>("SELECT setting_key, value FROM settings")).map((r) => [r.setting_key, r.value]),
  );
  let methods: Partial<Record<Provider, boolean>> = {};
  try {
    methods = JSON.parse(data.payment_methods ?? "{}");
  } catch {
    /* keep defaults */
  }
  return {
    site_name: data.site_name ?? "JUJ",
    support_email: data.support_email ?? "",
    auto_complete_hours: Number(data.auto_complete_hours ?? 72) || 72,
    payment_methods: Object.fromEntries(PROVIDERS.map((p) => [p, methods[p] !== false])) as Record<Provider, boolean>,
  };
}

export async function saveSettings(s: Settings) {
  const pairs: [string, string][] = [
    ["site_name", s.site_name],
    ["support_email", s.support_email],
    ["auto_complete_hours", String(s.auto_complete_hours)],
    ["payment_methods", JSON.stringify(s.payment_methods)],
  ];
  for (const [k, v] of pairs) {
    await exec("INSERT INTO settings (setting_key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [k, v]);
  }
}
