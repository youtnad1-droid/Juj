from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import asyncio
import json
import logging
import os
import re

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Helper service for the JUJ Node app: AI translation + forwarding /api/* to the app.
logger = logging.getLogger("juj-helper")
app = FastAPI()
UPSTREAM = os.environ["APP_UPSTREAM_URL"]
SECRET = os.environ["INTERNAL_API_SECRET"]
LOCALE_NAMES = {
    "ar": "Arabic", "fr": "French", "ko": "Korean", "id": "Indonesian",
    "zh": "Simplified Chinese", "ru": "Russian", "es": "Spanish", "en": "English",
}
SYSTEM = (
    "You translate product listings for a digital goods marketplace. Keep brand names, "
    "product names, numbers, currencies and codes unchanged. Return ONLY JSON: "
    '{"<locale>": {"title": "...", "description": "..."}} for every requested locale.'
)


class TranslateItem(BaseModel):
    id: str
    title: str = Field(max_length=300)
    description: str = Field(default="", max_length=8000)


class TranslateRequest(BaseModel):
    items: list[TranslateItem] = Field(max_length=50)
    locales: list[str]


def parse_json(text: str) -> dict:
    start = text.find("{")
    return json.JSONDecoder().raw_decode(text[start:])[0] if start >= 0 else {}


async def translate_one(item: TranslateItem, locales: list[str]) -> dict:
    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"tr-{item.id}", system_message=SYSTEM
    ).with_model("openai", "gpt-5.4-mini")
    payload = {"title": item.title, "description": item.description,
               "locales": {l: LOCALE_NAMES[l] for l in locales if l in LOCALE_NAMES}}
    data = {}
    for _ in range(3):
        try:
            data = parse_json(await chat.send_message(UserMessage(text=json.dumps(payload, ensure_ascii=False))))
            break
        except ValueError:
            continue
    return {l: v for l, v in data.items() if l in payload["locales"] and isinstance(v, dict)}


@app.post("/api/internal/translate")
async def translate(req: TranslateRequest, request: Request):
    if request.headers.get("x-internal-secret") != SECRET:
        raise HTTPException(403, "forbidden")
    sem = asyncio.Semaphore(6)

    async def run(i):
        async with sem:
            return await translate_one(i, req.locales)

    out = await asyncio.gather(*(run(i) for i in req.items), return_exceptions=True)
    results = {}
    for item, r in zip(req.items, out):
        if isinstance(r, Exception):
            logger.error("translate failed for %s: %s", item.id, r)
        else:
            results[item.id] = r
    return {"results": results}


HOP = {"host", "connection", "keep-alive", "transfer-encoding", "content-length", "content-encoding", "upgrade"}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def forward(path: str, request: Request):
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
    headers["x-forwarded-host"] = request.headers.get("host", "")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.request(
            request.method, f"{UPSTREAM}/api/{path}", params=request.query_params,
            content=await request.body(), headers=headers,
        )
    resp = Response(content=r.content, status_code=r.status_code)
    for k, v in r.headers.multi_items():
        if k.lower() not in HOP:
            resp.headers.append(k, v)
    return resp
