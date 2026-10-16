"""Builds database/seed.sql from the data exported from the old Supabase project (database/source/*.json)."""
import json
import random
import string
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt

ROOT = Path(__file__).resolve().parent.parent / "database"
SRC = ROOT / "source"
PASSWORD = "JujDemo2026!"
USERS = [
    ("00000000-0000-4000-a000-000000000001", "admin@juj.test", "admin"),
    ("00000000-0000-4000-a000-000000000011", "pixelvault@juj.test", "seller"),
    ("00000000-0000-4000-a000-000000000012", "keyforge@juj.test", "seller"),
    ("00000000-0000-4000-a000-000000000013", "robloxking@juj.test", "seller"),
    ("00000000-0000-4000-a000-000000000021", "buyer1@juj.test", "buyer"),
    ("00000000-0000-4000-a000-000000000022", "buyer2@juj.test", "buyer"),
]


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
    return f"'{s}'"


def dt(v):
    return datetime.fromisoformat(v).astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def insert(table, rows):
    if not rows:
        return ""
    cols = list(rows[0].keys())
    vals = ",\n".join("(" + ",".join(q(r[c]) for c in cols) + ")" for r in rows)
    return f"INSERT INTO {table} ({','.join(cols)}) VALUES\n{vals};\n\n"


def load(name):
    return json.loads((SRC / f"{name}.json").read_text())


def main():
    random.seed(7)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    pw = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(10)).decode()
    out = ["SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n"]
    out.append(insert("users", [
        {"id": i, "email": e, "password_hash": pw, "role": r, "email_verified_at": now} for i, e, r in USERS
    ]))
    out.append(insert("seller_profiles", [
        {**{k: s[k] for k in ("user_id", "display_name", "bio", "country", "verification_status",
                              "rating_avg", "rating_count", "sales_count")}, "created_at": dt(s["created_at"])}
        for s in load("seller_profiles")
    ]))
    cats = sorted(load("categories"), key=lambda c: (c["parent_id"] is not None, c["sort_order"]))
    out.append(insert("categories", [
        {k: c[k] for k in ("id", "parent_id", "slug", "name", "icon", "seo_text", "commission_percent",
                           "sort_order", "show_in_header", "is_active")} for c in cats
    ]))
    offers = load("offers")
    out.append(insert("offers", [
        {**{k: o[k] for k in ("id", "seller_id", "category_id", "slug", "title", "description", "image_url",
                              "price_minor", "old_price_minor", "currency", "delivery_type", "stock_count",
                              "sales_count", "status", "region", "platform")}, "created_at": dt(o["created_at"])}
        for o in offers
    ]))
    out.append(insert("offer_options", [
        {k: o[k] for k in ("id", "offer_id", "label", "price_minor", "sort_order")} for o in load("offer_options")
    ]))
    out.append(insert("offer_input_fields", [
        {"id": f["id"], "offer_id": f["offer_id"], "field_key": f["key"], "label": f["label"], "type": f["type"],
         "select_options": json.dumps(f["select_options"]) if f["select_options"] else None,
         "required": f["required"], "sort_order": f["sort_order"]} for f in load("offer_input_fields")
    ]))
    codes = []
    for o in offers:
        if o["delivery_type"] == "auto_codes":
            for _ in range(5):
                part = lambda: "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
                codes.append({"offer_id": o["id"], "code": f"DEMO-{part()}-{part()}-{part()}"})
    out.append(insert("offer_codes", codes))

    # Demo completed orders with reviews so seller pages show real buyer feedback.
    comments = [
        (5, "Code arrived instantly and worked on the first try. Thanks!"),
        (5, "Fast delivery, friendly seller."),
        (4, "All good, took a few minutes but worked."),
        (5, "Second purchase here, always reliable."),
        (5, "Exactly as described."),
        (4, "Good price, would buy again."),
    ]
    orders, reviews = [], []
    buyers = ["00000000-0000-4000-a000-000000000021", "00000000-0000-4000-a000-000000000022"]
    picks = [o for o in offers][:: max(1, len(offers) // 6)][:6]
    for idx, (o, (rating, text)) in enumerate(zip(picks, comments), start=1):
        when = (datetime.now(timezone.utc) - timedelta(days=30 - idx * 4)).strftime("%Y-%m-%d %H:%M:%S")
        orders.append({
            "id": idx, "buyer_id": buyers[idx % 2], "seller_id": o["seller_id"], "offer_id": o["id"],
            "offer_title": o["title"], "quantity": 1, "unit_price_minor": o["price_minor"],
            "total_minor": o["price_minor"], "commission_minor": round(o["price_minor"] * 0.1),
            "currency": "USD", "delivery_type": o["delivery_type"], "status": "completed",
            "payment_provider": "stripe", "payment_ref": f"demo_{idx}", "paid_at": when,
            "delivered_at": when, "completed_at": when, "created_at": when,
        })
        reviews.append({"order_id": idx, "buyer_id": buyers[idx % 2], "seller_id": o["seller_id"],
                        "offer_id": o["id"], "rating": rating, "comment": text, "created_at": when})
    out.append(insert("orders", orders))
    out.append(insert("reviews", reviews))
    out.append(insert("settings", [
        {"setting_key": "site_name", "value": "JUJ"},
        {"setting_key": "support_email", "value": "support@juj.gg"},
        {"setting_key": "auto_complete_hours", "value": "72"},
        {"setting_key": "payment_methods", "value": json.dumps({"stripe": True, "paypal": True, "razorpay": True, "crypto": True})},
    ]))
    out.append("SET FOREIGN_KEY_CHECKS = 1;\n")
    (ROOT / "seed.sql").write_text("".join(out))
    print("seed.sql written:", len(offers), "offers,", len(codes), "codes")


if __name__ == "__main__":
    main()
