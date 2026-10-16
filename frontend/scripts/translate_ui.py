"""Extracts t("...") / m("...") UI strings from src and AI-translates them into src/i18n/<locale>.json."""
import asyncio
import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")
SRC = Path(__file__).resolve().parent.parent / "src"
LOCALES = {"ar": "Arabic", "fr": "French", "ko": "Korean", "id": "Indonesian",
           "zh": "Simplified Chinese", "ru": "Russian", "es": "Spanish"}
PATTERN = re.compile(r"""\b[tm]\(\s*(["'`])((?:\\.|(?!\1).)*)\1""", re.S)
SYSTEM = ("You translate UI strings of a digital goods marketplace website. Keep placeholders like {n} or {name} "
          "exactly, keep brand names (JUJ, Stripe, PayPal, Razorpay, Roblox, PlayStation) unchanged. "
          "Return ONLY a JSON object mapping each English string to its translation.")


def extract():
    found = set()
    for f in SRC.rglob("*.ts*"):
        for q, s in PATTERN.findall(f.read_text()):
            if q != "`" or "${" not in s:
                found.add(s.encode().decode("unicode_escape") if "\\" in s else s)
    return sorted(x for x in found if x.strip())


async def chunk(sem, loc, strings):
    async with sem:
        for attempt in range(3):
            try:
                chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"ui-{loc}-{hash(strings[0])}-{attempt}",
                               system_message=SYSTEM).with_model("openai", "gpt-5.4-mini")
                text = await chat.send_message(UserMessage(text=f"Target language: {LOCALES[loc]}\n" + json.dumps(strings, ensure_ascii=False)))
                data = json.loads(re.search(r"\{.*\}", text, re.S).group(0))
                return {k: v for k, v in data.items() if k in strings and isinstance(v, str) and v.strip()}
            except Exception as e:
                print("retry", loc, e)
        return {}


async def main():
    strings = extract()
    print(len(strings), "strings")
    sem = asyncio.Semaphore(10)
    parts = [strings[i:i + 60] for i in range(0, len(strings), 60)]
    for loc in LOCALES:
        path = SRC / "i18n" / f"{loc}.json"
        old = json.loads(path.read_text() or "{}")
        todo = [s for s in strings if s not in old]
        res = await asyncio.gather(*(chunk(sem, loc, todo[i:i + 60]) for i in range(0, len(todo), 60)))
        for r in res:
            old.update(r)
        path.write_text(json.dumps(dict(sorted(old.items())), ensure_ascii=False, indent=1) + "\n")
        print(loc, len(old), "/", len(strings))
    del parts


if __name__ == "__main__":
    asyncio.run(main())
