import { exec } from "./db.server";

const TARGETS = ["ar", "fr", "ko", "id", "zh", "ru", "es"];
type Item = { type: "offer" | "category"; id: string; title: string; description: string };

/** AI-translates titles/descriptions via the helper service and stores them. Safe to fire-and-forget. */
export async function translateItems(items: Item[]) {
  const base = process.env.TRANSLATE_SERVICE_URL;
  if (!base || !items.length) return 0;
  try {
    const r = await fetch(`${base}/api/internal/translate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "" },
      body: JSON.stringify({ items: items.map((i) => ({ id: `${i.type}:${i.id}`, title: i.title, description: i.description })), locales: TARGETS }),
    });
    if (!r.ok) throw new Error(`translate service ${r.status}`);
    const { results } = (await r.json()) as { results: Record<string, Record<string, { title?: string; description?: string }>> };
    let n = 0;
    for (const [key, byLocale] of Object.entries(results)) {
      const [type, id] = key.split(":");
      for (const [loc, v] of Object.entries(byLocale)) {
        if (!v.title) continue;
        await exec(
          `INSERT INTO content_translations (entity_type, entity_id, locale, title, description) VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description)`,
          [type, id, loc, v.title.slice(0, 255), v.description ?? null],
        );
        n++;
      }
    }
    return n;
  } catch (e) {
    console.error("[translate] failed", e);
    return 0;
  }
}
