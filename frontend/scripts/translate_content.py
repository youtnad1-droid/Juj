"""AI-translates seeded offer + category texts into all site languages -> database/translations.sql."""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

sys.path.insert(0, str(Path(__file__).parent))
from build_seed import insert, load  # noqa: E402

load_dotenv("/app/backend/.env")
ROOT = Path(__file__).resolve().parent.parent / "database"
LOCALES = {"ar": "Arabic", "fr": "French", "ko": "Korean", "id": "Indonesian",
           "zh": "Simplified Chinese", "ru": "Russian", "es": "Spanish"}
SYSTEM = ("You translate product listings for a digital goods marketplace. Keep brand names, product names, "
          "numbers, currencies and codes unchanged. Return ONLY JSON: "
          '{"<locale>": {"title": "...", "description": "..."}} for every requested locale.')


async def translate(sem, key, title, desc):
    async with sem:
        for attempt in range(3):
            try:
                chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"seed-{key}-{attempt}",
                               system_message=SYSTEM).with_model("openai", "gpt-5.4-mini")
                text = await chat.send_message(UserMessage(text=json.dumps(
                    {"title": title, "description": desc or "", "locales": LOCALES}, ensure_ascii=False)))
                data = json.loads(re.search(r"\{.*\}", text, re.S).group(0))
                if all(l in data for l in LOCALES):
                    return key, data
            except Exception as e:  # retry on bad JSON / transient errors
                print("retry", key, e)
        return key, {}


async def main():
    sem = asyncio.Semaphore(8)
    jobs = [translate(sem, ("offer", str(o["id"])), o["title"], o["description"]) for o in load("offers")]
    jobs += [translate(sem, ("category", c["id"]), c["name"], c["seo_text"]) for c in load("categories")]
    rows = []
    for (etype, eid), data in await asyncio.gather(*jobs):
        for loc, v in data.items():
            if loc in LOCALES and isinstance(v, dict) and v.get("title"):
                rows.append({"entity_type": etype, "entity_id": eid, "locale": loc,
                             "title": v["title"][:255], "description": v.get("description") or None})
    sql = "SET NAMES utf8mb4;\nDELETE FROM content_translations;\n" + insert("content_translations", rows)
    (ROOT / "translations.sql").write_text(sql)
    print("translations.sql written:", len(rows), "rows")


if __name__ == "__main__":
    asyncio.run(main())
