# JUJ marketplace: public pages + Stripe webhook (signed) regression tests
import hashlib
import hmac
import json
import os
import subprocess
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WHSEC = os.environ.get("STRIPE_WEBHOOK_SECRET")
MYSQL = ["mysql", "-h127.0.0.1", "-ujuj", f"-p{os.environ.get('DB_PASSWORD')}", "juj", "-N", "-e"]


def sql(q):
    return subprocess.run(MYSQL + [q], capture_output=True, text=True).stdout.strip()


def signed(payload: dict):
    body = json.dumps(payload)
    ts = int(time.time())
    sig = hmac.new(WHSEC.encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
    return body, f"t={ts},v1={sig}"


# Public pages (SSR) load with seeded data
@pytest.mark.parametrize("path", ["/", "/auth", "/catalog/roblox", "/search?q=roblox",
                                  "/catalog/product/roblox-gift-card-robux-code-1"])
def test_public_pages(path):
    r = requests.get(BASE_URL + path, timeout=30)
    assert r.status_code == 200


def test_offer_ssr_title():
    r = requests.get(BASE_URL + "/catalog/product/roblox-gift-card-robux-code-1", timeout=30)
    assert "Roblox Gift Card" in r.text


# Stripe webhook signature check
def test_webhook_rejects_bad_signature():
    r = requests.post(BASE_URL + "/api/stripe/webhook", data="{}", headers={"stripe-signature": "t=1,v1=bad"}, timeout=30)
    assert r.status_code == 400


def test_webhook_marks_pending_order_paid():
    if not WHSEC:
        pytest.skip("no STRIPE_WEBHOOK_SECRET in env")
    row = sql("SELECT id, payment_ref FROM orders WHERE status='pending_payment' AND payment_provider='stripe' ORDER BY id DESC LIMIT 1")
    if not row:
        pytest.skip("no pending stripe order")
    oid, ref = row.split("\t")
    body, sig = signed({"id": "evt_test", "object": "event", "type": "checkout.session.completed",
                        "data": {"object": {"id": ref, "payment_status": "paid"}}})
    r = requests.post(BASE_URL + "/api/stripe/webhook", data=body,
                      headers={"stripe-signature": sig, "content-type": "application/json"}, timeout=30)
    assert r.status_code == 200, r.text
    status = sql(f"SELECT status FROM orders WHERE id={oid}")
    assert status in ("paid", "delivered")
