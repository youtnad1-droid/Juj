"""Tests for TanStack Start REST API endpoints (served by Vite on :3000).

External /api/* is routed to FastAPI (unused). We test local endpoints directly.
"""
import os
import requests
import pytest

LOCAL_BASE = "http://localhost:3000"
EXT_BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or None


class TestCategories:
    def test_categories_local(self):
        r = requests.get(f"{LOCAL_BASE}/api/v1/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "data" in data and isinstance(data["data"], list) and len(data["data"]) > 0
        root = data["data"][0]
        assert "id" in root and "slug" in root and "name" in root
        assert "children" in root

    def test_categories_external_routing(self):
        """External /api/* hits FastAPI backend, not Vite - documents the routing issue."""
        if not EXT_BASE:
            pytest.skip("no external url")
        r = requests.get(f"{EXT_BASE}/api/v1/categories", timeout=15)
        # Document actual behavior; this is expected to fail against ingress
        assert r.status_code == 200, f"External /api/v1 returns {r.status_code} - ingress routes to unused FastAPI"


class TestOffers:
    def test_list_offers(self):
        r = requests.get(f"{LOCAL_BASE}/api/v1/offers?limit=5", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and len(data["items"]) <= 5
        assert len(data["items"]) > 0
        first = data["items"][0]
        for k in ("id", "slug", "title", "price_minor", "currency"):
            assert k in first

    def test_offers_pagination_cursor(self):
        r = requests.get(f"{LOCAL_BASE}/api/v1/offers?limit=2", timeout=15)
        assert r.status_code == 200
        data = r.json()
        # nextCursor expected key per spec
        assert "nextCursor" in data or "next_cursor" in data or "cursor" in data, f"missing cursor field: keys={list(data.keys())}"

    def test_offer_detail(self):
        r = requests.get(f"{LOCAL_BASE}/api/v1/offers?limit=1", timeout=15)
        oid = r.json()["items"][0]["id"]
        r2 = requests.get(f"{LOCAL_BASE}/api/v1/offers/{oid}", timeout=15)
        assert r2.status_code == 200
        detail = r2.json()
        payload = detail.get("data", detail)
        offer = payload.get("offer", payload)
        assert offer.get("id") == oid


class TestSellers:
    def test_seller_detail(self):
        # Get a seller id from an offer
        r = requests.get(f"{LOCAL_BASE}/api/v1/offers?limit=1", timeout=15)
        offer = r.json()["items"][0]
        detail = requests.get(f"{LOCAL_BASE}/api/v1/offers/{offer['id']}", timeout=15).json()
        payload = detail.get("data", detail)
        seller = payload.get("seller") or {}
        seller_id = seller.get("user_id") or seller.get("id") or payload.get("seller_id")
        if not seller_id:
            pytest.skip(f"no seller id in offer detail: {list(detail.keys())}")
        r2 = requests.get(f"{LOCAL_BASE}/api/v1/sellers/{seller_id}", timeout=15)
        assert r2.status_code == 200
        payload = r2.json()
        s = (payload.get("data", {}) or {}).get("seller") or payload.get("seller") or payload
        assert "name" in s or "display_name" in s


class TestSearch:
    def test_search_robux(self):
        r = requests.get(f"{LOCAL_BASE}/api/v1/search?q=robux", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and len(data["items"]) > 0
        assert any("robux" in i["title"].lower() for i in data["items"])
