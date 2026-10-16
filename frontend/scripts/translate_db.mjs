// AI-translates every offer + category missing translations (via the helper service) into content_translations.
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")
  .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const TARGETS = ["ar", "fr", "ko", "id", "zh", "ru", "es"];
const db = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, charset: "UTF8MB4_UNICODE_CI" });

const [offers] = await db.query(`SELECT CONCAT('offer:', id) id, title, description FROM offers o WHERE status <> 'archived'
  AND (SELECT COUNT(*) FROM content_translations t WHERE t.entity_type = 'offer' AND t.entity_id = CAST(o.id AS CHAR)) < 7`);
const [cats] = await db.query(`SELECT CONCAT('category:', id) id, name title, COALESCE(seo_text, '') description FROM categories c
  WHERE (SELECT COUNT(*) FROM content_translations t WHERE t.entity_type = 'category' AND t.entity_id = c.id) < 7`);
const items = [...offers, ...cats].map((i) => ({ ...i, description: i.description ?? "" }));
console.log("to translate:", items.length);

for (let i = 0; i < items.length; i += 12) {
  const r = await fetch(`${env.TRANSLATE_SERVICE_URL}/api/internal/translate`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": env.INTERNAL_API_SECRET },
    body: JSON.stringify({ items: items.slice(i, i + 12), locales: TARGETS }),
  });
  const { results } = await r.json();
  for (const [key, byLoc] of Object.entries(results)) {
    const [type, id] = key.split(":");
    for (const [loc, v] of Object.entries(byLoc)) {
      if (!v.title) continue;
      await db.query(`INSERT INTO content_translations (entity_type, entity_id, locale, title, description) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description)`, [type, id, loc, v.title.slice(0, 255), v.description || null]);
    }
  }
  console.log("done", Math.min(i + 12, items.length), "/", items.length);
}
await db.end();
