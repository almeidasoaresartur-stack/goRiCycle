"""Protecções das 4 lojas (Certideal, Refurbed, Callphone, Swappie) e do sumário.

Sem browser e sem rede: cobre a deduplicação que apagava iPads, as variantes
JSON-LD, o retry da Callphone e a validação live que não pode esvaziar uma loja.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

_SCRAPERS_DIR = Path(__file__).resolve().parent
_ROOT = _SCRAPERS_DIR.parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

import run_all
from callphone_scraper import (
    MAX_FETCH_ATTEMPTS,
    CallphoneFetchError,
    _retry_delay,
    fetch_all_products,
    fetch_products_page,
)
from certideal_scraper import (
    CANONICAL_IPAD_LISTING_URL,
    display_clean_model,
    extract_product,
    init_variant_registry,
    is_known_duplicate,
    parse_certideal_listing_text,
    purge_category,
    scrape_family_listing,
    storage_from_url,
    tablet_listing_to_read,
)
from certideal_urls import CERTIDEAL_URLS
from check_run_summary import evaluate_run
from refurbed_scraper import (
    cheapest_per_storage,
    keep_generic_and_append_variants,
    parse_product_group_variants,
    records_from_product_group,
)
from validate_and_clean import (
    INCONCLUSIVE_STREAK_STOP,
    is_inconclusive,
    validate_source,
    verify_url_live,
)

MINI_URL = (
    "https://www.certideal.pt/ipad-mini-6-wifi/"
    "ipad-mini-6-2021-a15-series-64-gb-cinzento-sideral-wifi-15384"
)
PRO_URL = (
    "https://www.certideal.pt/ipad-pro-129-2021-wifi-5g/"
    "ipad-pro-129-2021-5a-geracao-256-gb-cinzento-sideral-wifi-5g-7281"
)
SCRAPED_AT = "2026-10-12T00:00:00+00:00"

PRODUCT_GROUP_HTML = """
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}
</script>
<script type="application/ld+json">
{
  "@type": "ProductGroup",
  "name": "iPad 9 (2021)",
  "hasVariant": [
    {
      "@type": "Product",
      "size": "64 GB",
      "color": "cinzento",
      "offers": {
        "@type": "Offer",
        "url": "https://www.refurbed.pt/p/ipad-9-2021/14236aa/?offer=1",
        "price": "260.99",
        "availability": "https://schema.org/InStock"
      }
    },
    {
      "@type": "Product",
      "size": "64 GB",
      "color": "prata",
      "offers": {
        "url": "https://www.refurbed.pt/p/ipad-9-2021/999bb/?offer=2",
        "price": 240.5,
        "availability": "https://schema.org/InStock"
      }
    },
    {
      "@type": "Product",
      "size": "256 GB",
      "color": "cinzento",
      "offers": {
        "url": "https://www.refurbed.pt/p/ipad-9-2021/256aa",
        "price": 310.0,
        "availability": "https://schema.org/InStock"
      }
    },
    {
      "@type": "Product",
      "size": "32 GB",
      "color": "ouro",
      "offers": {
        "url": "https://www.refurbed.pt/p/ipad-9-2021/oos/",
        "price": 0,
        "availability": "https://schema.org/OutOfStock"
      }
    }
  ]
}
</script>
"""


def _ipad_card(model: str, url: str, price: float, storage: str = "64GB") -> dict:
    return {
        "model": model,
        "url": url,
        "listing_price": price,
        "storage": storage,
        "source_page": CANONICAL_IPAD_LISTING_URL,
    }


class CertidealIpadTests(unittest.TestCase):
    def test_listing_url_is_first_ipad_family(self) -> None:
        first = CERTIDEAL_URLS["ipads"][0]
        self.assertEqual(first["url"], CANONICAL_IPAD_LISTING_URL)
        self.assertTrue(first["url"].startswith("https://"))

    def test_storage_and_name_from_real_skus(self) -> None:
        self.assertEqual(storage_from_url(MINI_URL), "64GB")
        self.assertEqual(storage_from_url(PRO_URL), "256GB")
        self.assertIsNone(storage_from_url("https://www.certideal.pt/ipad-mini-350"))
        self.assertEqual(
            display_clean_model(
                "iPad Pro 12.9 (2021) 5a Geração 256 GB Cinzento Sideral - Wifi + 5G"
            ),
            "iPad Pro 12.9 (2021) 5a geração",
        )
        self.assertEqual(
            display_clean_model("iPad Mini 6 (2021 A15 Series) 64 GB Cinzento Sideral - Wifi"),
            "iPad Mini 6 (2021 a15 series)",
        )
        # Nos iPhones o nome não passa pela limpeza de iPad.
        self.assertIn("sideral", display_clean_model("iPhone 13 Sideral").lower())

    def test_listing_price_with_thousands_separator(self) -> None:
        parsed = parse_certideal_listing_text("iPad Pro 12.9 (2021) 5a...\n1 299,99 €\nCorreto")
        self.assertEqual(parsed["price"], 1299.99)
        parsed_mini = parse_certideal_listing_text("iPad Mini 6 (2021 A15 Series) 64 GB...\n429,99 €")
        self.assertEqual(parsed_mini["price"], 429.99)
        self.assertEqual(parsed_mini["storage"], "64GB")

    def test_http_hub_is_read_as_https_listing(self) -> None:
        landed = "http://www.certideal.pt/tablettes-reconditionnees-118"
        self.assertEqual(tablet_listing_to_read(landed), CANONICAL_IPAD_LISTING_URL)
        self.assertEqual(
            tablet_listing_to_read("https://www.certideal.pt/ipad"),
            CANONICAL_IPAD_LISTING_URL,
        )
        self.assertEqual(
            tablet_listing_to_read(CANONICAL_IPAD_LISTING_URL),
            CANONICAL_IPAD_LISTING_URL,
        )

    def test_duplicate_sku_is_not_treated_as_out_of_stock(self) -> None:
        """O mesmo SKU em duas famílias devolvia [] e o ciclo apagava o original."""
        registry: dict = {}
        removed: set[str] = set()
        first = _ipad_card(
            "iPad Mini 6 (2021 A15 Series) 64 GB Cinzento Sideral - Wifi",
            MINI_URL,
            429.99,
        )
        kept = extract_product(first, "ipads", first["source_page"], SCRAPED_AT, registry, removed)
        self.assertEqual(len(kept), 1)
        products = list(kept)

        truncated = _ipad_card("iPad Mini 6 (2021 A15 Series) 64 GB...", MINI_URL, 429.99)
        second = extract_product(
            truncated, "ipads", truncated["source_page"], SCRAPED_AT, registry, removed
        )
        self.assertEqual(second, [])
        self.assertTrue(truncated.get("_duplicate"))
        self.assertTrue(is_known_duplicate(second, truncated))
        # Não chamar remove_products_by_url: o original fica para o purge seguinte.
        products, known_ids = purge_category(
            products, {products[0]["product_id"]}, "samsung_phones"
        )
        rebuilt = init_variant_registry(products)
        self.assertEqual(known_ids, {products[0]["product_id"]})
        self.assertEqual(len(rebuilt), 1)
        self.assertEqual(rebuilt[next(iter(rebuilt))]["category"], "ipads")

    def test_same_model_more_expensive_duplicate_keeps_the_cheaper(self) -> None:
        registry: dict = {}
        removed: set[str] = set()
        first = _ipad_card("iPad Mini 6 (2021 A15 Series) 64 GB", MINI_URL, 429.99)
        extract_product(first, "ipads", first["source_page"], SCRAPED_AT, registry, removed)
        other_url = "https://www.certideal.pt/ipad-mini-6-wifi/ipad-mini-6-outro-64-gb-99999"
        dearer = _ipad_card("iPad Mini 6 (2021 A15 Series) 64 GB", other_url, 499.99)
        second = extract_product(dearer, "ipads", dearer["source_page"], SCRAPED_AT, registry, removed)
        self.assertEqual(second, [])
        self.assertTrue(is_known_duplicate(second, dearer))
        self.assertEqual(removed, set())
        self.assertEqual(next(iter(registry.values()))["price"], 429.99)

    def test_redirected_ipad_family_reads_https_listing_once(self) -> None:
        calls: list[tuple[str, bool]] = []

        def open_redirect(page, url: str) -> int:
            del url
            page.url = "http://www.certideal.pt/tablettes-reconditionnees-118"
            return 200

        def open_canonical(page, url: str) -> int:
            page.url = url
            return 200

        def scrape(page, url: str, page_ready: bool = False) -> list[dict]:
            del page
            calls.append((url, page_ready))
            return [{"model": "iPad Mini 6", "url": MINI_URL}]

        visited: set[str] = set()
        with (
            patch("certideal_scraper.human_delay"),
            patch("certideal_scraper.page_wait_ms"),
            patch("certideal_scraper.dismiss_cookie_banner"),
            patch("certideal_scraper.scrape_category_listing", scrape),
        ):
            page = type("Page", (), {"url": ""})()
            with patch("certideal_scraper.open_listing_url", open_canonical):
                direct = scrape_family_listing(
                    page,
                    CANONICAL_IPAD_LISTING_URL,
                    "iPad (listagem geral)",
                    "ipads",
                    visited_hubs=visited,
                )
            self.assertEqual(len(direct), 1)
            self.assertIn("ipad-recondicionados-118", visited)

            with patch("certideal_scraper.open_listing_url", open_redirect):
                again = scrape_family_listing(
                    page,
                    "https://www.certideal.pt/ipad-11-wifi-580",
                    "iPad 11",
                    "ipads",
                    visited_hubs=visited,
                )
            self.assertEqual(again, [])

            fresh: set[str] = set()
            with patch("certideal_scraper.open_listing_url", open_redirect):
                followed = scrape_family_listing(
                    page,
                    "https://www.certideal.pt/ipad-11-wifi-580",
                    "iPad 11",
                    "ipads",
                    visited_hubs=fresh,
                )
            self.assertEqual(len(followed), 1)
            self.assertEqual(followed[0]["source_page"], CANONICAL_IPAD_LISTING_URL)

        self.assertEqual(calls[0][0], CANONICAL_IPAD_LISTING_URL)
        self.assertTrue(calls[0][1])
        self.assertEqual(calls[1], (CANONICAL_IPAD_LISTING_URL, False))
        self.assertEqual(len(calls), 2)

    def test_iphone_redirect_to_hub_is_still_skipped(self) -> None:
        def open_redirect(page, url: str) -> int:
            del url
            page.url = "http://www.certideal.pt/tablettes-reconditionnees-118"
            return 200

        warnings: list[str] = []
        with (
            patch("certideal_scraper.open_listing_url", open_redirect),
            patch("certideal_scraper.scrape_category_listing") as scrape,
        ):
            page = type("Page", (), {"url": ""})()
            cards = scrape_family_listing(
                page,
                "https://www.certideal.pt/iphone-11-recondicionado-213",
                "iPhone 11",
                "iphones",
                warnings=warnings,
                visited_hubs=set(),
            )
        self.assertEqual(cards, [])
        self.assertTrue(warnings)
        scrape.assert_not_called()


class RefurbedProductGroupTests(unittest.TestCase):
    def test_parses_instock_variants_and_keeps_cheapest_per_storage(self) -> None:
        variants = parse_product_group_variants(PRODUCT_GROUP_HTML)
        self.assertEqual(len(variants), 3)
        self.assertTrue(all(item["storage"] in {"64GB", "256GB"} for item in variants))
        self.assertTrue(all("?" not in (item["url"] or "") for item in variants))

        records = records_from_product_group(
            html=PRODUCT_GROUP_HTML,
            category="tablets",
            model='iPad 9 (2021) | 10.2"',
            image_url=None,
            source_page="https://www.refurbed.pt/p/ipad-9-2021/",
            scraped_at=SCRAPED_AT,
            original_price=None,
            seller_rating=None,
        )
        by_storage = {record["storage"]: record for record in records}
        self.assertEqual(set(by_storage), {"64GB", "256GB"})
        self.assertEqual(by_storage["64GB"]["price"], 240.5)
        self.assertTrue(by_storage["64GB"]["url"].endswith("/999bb/"))
        self.assertTrue(by_storage["256GB"]["url"].endswith("/256aa/"))

    def test_generic_record_survives_next_to_storage_variants(self) -> None:
        group = records_from_product_group(
            html=PRODUCT_GROUP_HTML,
            category="tablets",
            model='iPad 9 (2021) | 10.2"',
            image_url=None,
            source_page="https://www.refurbed.pt/p/ipad-9-2021/",
            scraped_at=SCRAPED_AT,
            original_price=None,
            seller_rating=None,
        )
        generic = {
            "model": 'iPad 9 (2021) | 10.2"',
            "storage": None,
            "price": 260.99,
            "url": "https://www.refurbed.pt/p/ipad-9-2021/",
        }
        merged = cheapest_per_storage(keep_generic_and_append_variants([generic], group))
        self.assertEqual(sum(1 for record in merged if not record.get("storage")), 1)
        self.assertEqual(
            {record["storage"] for record in merged if record.get("storage")},
            {"64GB", "256GB"},
        )

    def test_missing_product_group_adds_nothing(self) -> None:
        self.assertEqual(parse_product_group_variants("<html></html>"), [])
        self.assertEqual(keep_generic_and_append_variants([{"storage": None}], []), [{"storage": None}])


class CallphoneRetryTests(unittest.TestCase):
    def test_backoff_schedule_and_retry_after(self) -> None:
        self.assertEqual(MAX_FETCH_ATTEMPTS, 5)
        self.assertEqual(_retry_delay(None, 1), 5.0)
        self.assertEqual(_retry_delay(None, 2), 10.0)
        self.assertEqual(_retry_delay(None, 3), 20.0)
        self.assertEqual(_retry_delay(None, 4), 40.0)
        self.assertEqual(_retry_delay(None, 5), 60.0)
        self.assertEqual(_retry_delay(httpx.Response(429, headers={"Retry-After": "9"}), 1), 9.0)
        self.assertEqual(_retry_delay(httpx.Response(429, headers={"Retry-After": "500"}), 1), 120.0)

    def test_two_429_then_200_recovers(self) -> None:
        calls: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(str(request.url))
            if len(calls) < 3:
                return httpx.Response(429, headers={"Retry-After": "0"})
            return httpx.Response(200, json={"products": [{"id": 7}]})

        client = httpx.Client(transport=httpx.MockTransport(handler))
        with patch("callphone_scraper.time.sleep") as sleep:
            data = fetch_products_page(client, "https://www.callphone.pt/products.json?page=1")
        self.assertEqual(len(calls), 3)
        self.assertEqual(data["products"][0]["id"], 7)
        self.assertEqual(sleep.call_count, 2)

    def test_persistent_429_raises_after_five_attempts(self) -> None:
        calls = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            del request
            calls["n"] += 1
            return httpx.Response(429)

        client = httpx.Client(transport=httpx.MockTransport(handler))
        with patch("callphone_scraper.time.sleep") as sleep, self.assertRaises(CallphoneFetchError):
            fetch_products_page(client, "https://www.callphone.pt/products.json?page=1")
        self.assertEqual(calls["n"], 5)
        self.assertEqual(sleep.call_count, 4)

    def test_http_404_is_not_retried(self) -> None:
        calls = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            del request
            calls["n"] += 1
            return httpx.Response(404)

        client = httpx.Client(transport=httpx.MockTransport(handler))
        with patch("callphone_scraper.time.sleep") as sleep, self.assertRaises(CallphoneFetchError):
            fetch_products_page(client, "https://www.callphone.pt/products.json?page=1")
        self.assertEqual(calls["n"], 1)
        sleep.assert_not_called()

    def test_network_error_is_retried(self) -> None:
        calls = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            del request
            calls["n"] += 1
            if calls["n"] == 1:
                raise httpx.ConnectError("recusado")
            return httpx.Response(200, json={"products": [{"id": 3}]})

        client = httpx.Client(transport=httpx.MockTransport(handler))
        with patch("callphone_scraper.time.sleep"):
            data = fetch_products_page(client, "https://www.callphone.pt/products.json?page=1")
        self.assertEqual(calls["n"], 2)
        self.assertEqual(data["products"][0]["id"], 3)

    def test_pause_between_pages_is_one_second(self) -> None:
        pages = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            del request
            pages["n"] += 1
            if pages["n"] == 1:
                return httpx.Response(200, json={"products": [{"id": index} for index in range(250)]})
            return httpx.Response(200, json={"products": []})

        client = httpx.Client(transport=httpx.MockTransport(handler))
        with patch("callphone_scraper.time.sleep") as sleep:
            products = fetch_all_products(client)
        self.assertEqual(len(products), 250)
        sleep.assert_any_call(1.0)

    def test_fetch_failure_keeps_previous_json_and_records_fatal_error(self) -> None:
        import callphone_scraper

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "callphone_produtos.json"
            path.write_text(
                json.dumps({"products": [{"product_id": "keep-me"}]}),
                encoding="utf-8",
            )
            stats_path = Path(tmp) / "stats.json"
            with (
                patch.object(callphone_scraper, "OUTPUT_JSON", path),
                patch.object(
                    callphone_scraper,
                    "fetch_all_products",
                    side_effect=CallphoneFetchError("HTTP 429 após 5 tentativas"),
                ),
            ):
                run_all.run_worker("callphone", "full", None, stats_path)
            stats = json.loads(stats_path.read_text(encoding="utf-8"))
            self.assertIn("429", stats["fatal_error"])
            self.assertEqual(stats["total"], 0)
            kept = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(kept["products"][0]["product_id"], "keep-me")

    def test_empty_catalog_raises_before_save(self) -> None:
        import callphone_scraper

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "callphone_produtos.json"
            path.write_text(json.dumps({"products": [{"product_id": "old"}]}), encoding="utf-8")
            stats_path = Path(tmp) / "stats.json"
            with (
                patch.object(callphone_scraper, "OUTPUT_JSON", path),
                patch.object(callphone_scraper, "fetch_all_products", return_value=[]),
            ):
                run_all.run_worker("callphone", "full", None, stats_path)
            stats = json.loads(stats_path.read_text(encoding="utf-8"))
            self.assertIn("0 produtos", stats["fatal_error"])
            kept = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(kept["products"][0]["product_id"], "old")


class ValidateLiveGuardTests(unittest.TestCase):
    def _products(self, count: int) -> list[dict]:
        return [
            {
                "model": f"iPhone 13 modelo {index}",
                "price": 499,
                "url": f"https://swappie.com/pt/iphone-13-modelo-{index}",
            }
            for index in range(count)
        ]

    def _validate(self, products: list[dict], handler) -> dict:
        transport = httpx.MockTransport(handler)
        real_client = httpx.Client

        def factory(*args, **kwargs):
            kwargs["transport"] = transport
            return real_client(*args, **kwargs)

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "swappie_produtos.json"
            path.write_text(json.dumps({"products": products}), encoding="utf-8")
            with (
                patch("validate_and_clean.httpx.Client", factory),
                patch("validate_and_clean.time.sleep"),
            ):
                return validate_source("swappie", path, dry_run=True, check_live=True)

    def test_block_status_timeout_and_cloudflare_are_inconclusive(self) -> None:
        def blocked(request: httpx.Request) -> httpx.Response:
            del request
            return httpx.Response(403, text="cloudflare")

        client = httpx.Client(transport=httpx.MockTransport(blocked))
        ok, reason = verify_url_live("https://swappie.com/pt/iphone-13", client, source="swappie")
        self.assertFalse(ok)
        self.assertTrue(is_inconclusive(reason))
        self.assertIn("403", reason)

        def timed_out(request: httpx.Request) -> httpx.Response:
            del request
            raise httpx.TimeoutException("lento")

        client = httpx.Client(transport=httpx.MockTransport(timed_out))
        ok, reason = verify_url_live("https://swappie.com/pt/iphone-13", client, source="swappie")
        self.assertTrue(is_inconclusive(reason))
        self.assertIn("Timeout", reason)

        def challenged(request: httpx.Request) -> httpx.Response:
            del request
            return httpx.Response(200, text="399 €", headers={"cf-mitigated": "challenge"})

        client = httpx.Client(transport=httpx.MockTransport(challenged))
        ok, reason = verify_url_live("https://swappie.com/pt/iphone-13", client, source="swappie")
        self.assertTrue(is_inconclusive(reason))

        def server_error(request: httpx.Request) -> httpx.Response:
            del request
            return httpx.Response(500, text="erro")

        client = httpx.Client(transport=httpx.MockTransport(server_error))
        ok, reason = verify_url_live("https://swappie.com/pt/iphone-13", client, source="swappie")
        self.assertFalse(is_inconclusive(reason))
        self.assertIn("500", reason)

    def test_429_is_retried_then_accepted(self) -> None:
        calls = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            del request
            calls["n"] += 1
            if calls["n"] == 1:
                return httpx.Response(429, headers={"Retry-After": "0"})
            return httpx.Response(200, text="499 €")

        client = httpx.Client(transport=httpx.MockTransport(handler))
        with patch("validate_and_clean.time.sleep"):
            ok, reason = verify_url_live(
                "https://swappie.com/pt/iphone-13", client, source="swappie"
            )
        self.assertTrue(ok)
        self.assertEqual(reason, "")
        self.assertEqual(calls["n"], 2)

    def test_all_403_keeps_offers_and_stops_after_streak(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            del request
            return httpx.Response(403, text="blocked")

        stats = self._validate(self._products(12), handler)
        self.assertEqual(stats["kept"], 12)
        self.assertEqual(stats["removed"], 0)
        self.assertEqual(stats["live_checked"], INCONCLUSIVE_STREAK_STOP)
        self.assertTrue(stats["live_check_stopped"])
        self.assertFalse(stats["live_removal_aborted"])
        self.assertFalse(any("403" in item["reason"] for item in stats["removed_items"]))
        self.assertTrue(any("403" in reason for reason in stats["inconclusive"]))

    def test_scattered_404_still_removes_those_offers(self) -> None:
        seen = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            del request
            seen["n"] += 1
            if seen["n"] == 1:
                return httpx.Response(404, text="missing")
            return httpx.Response(200, text="499 €")

        stats = self._validate(self._products(10), handler)
        self.assertEqual(stats["kept"], 9)
        self.assertEqual(stats["removed"], 1)
        self.assertEqual(stats["reasons"].get("404 Not Found"), 1)
        self.assertFalse(stats["live_removal_aborted"])
        self.assertFalse(stats["live_check_stopped"])

    def test_mass_404_aborts_live_removal(self) -> None:
        seen = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            del request
            seen["n"] += 1
            if seen["n"] <= 6:
                return httpx.Response(404, text="missing")
            return httpx.Response(200, text="499 €")

        stats = self._validate(self._products(10), handler)
        self.assertEqual(stats["kept"], 10)
        self.assertEqual(stats["removed"], 0)
        self.assertTrue(stats["live_removal_aborted"])
        self.assertEqual(stats["live_failed"], 6)
        self.assertEqual(stats["live_checked"], 10)

    def test_exactly_half_failures_still_removes(self) -> None:
        seen = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            del request
            seen["n"] += 1
            if seen["n"] <= 5:
                return httpx.Response(404, text="missing")
            return httpx.Response(200, text="499 €")

        stats = self._validate(self._products(10), handler)
        self.assertEqual(stats["removed"], 5)
        self.assertEqual(stats["kept"], 5)
        self.assertFalse(stats["live_removal_aborted"])

    def test_few_checks_do_not_trigger_mass_abort(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            del request
            return httpx.Response(404, text="missing")

        stats = self._validate(self._products(4), handler)
        self.assertEqual(stats["removed"], 4)
        self.assertEqual(stats["kept"], 0)
        self.assertFalse(stats["live_removal_aborted"])

    def test_local_price_rejection_does_not_need_live_check(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            del request
            raise AssertionError("a validação local não devia fazer GET")

        products = [
            {
                "model": "iPhone 13 barato",
                "price": 10,
                "url": "https://swappie.com/pt/iphone-13-barato",
            }
        ]
        stats = self._validate(products, handler)
        self.assertEqual(stats["removed"], 1)
        self.assertEqual(stats["kept"], 0)
        self.assertEqual(stats["live_checked"], 0)


class SummaryGuardTests(unittest.TestCase):
    def _stores(self) -> dict:
        return {
            "iservices": {"total": 200, "errors": 0, "by_category": {"iphones": 200}},
            "refurbed": {"total": 90, "errors": 0, "by_category": {"iphones": 90}},
            "swappie": {"total": 86, "errors": 0, "by_category": {"iphones": 86}},
            "certideal": {
                "total": 120,
                "errors": 0,
                "by_category": {"iphones": 118, "ipads": 2},
            },
            "callphone": {"total": 1500, "errors": 0, "by_category": {"iphones": 1500}},
        }

    def _check(
        self,
        sources: dict,
        *,
        mode: str = "full",
        before: dict[str, int | None] | None = None,
        after: dict[str, int] | None = None,
        validation: dict | None = None,
        catalog: int | None = 800,
    ) -> tuple[list[str], list[str]]:
        summary = {
            "mode": mode,
            "grand_total": sum(item.get("total", 0) for item in sources.values()),
            "sources": sources,
        }
        counts = {name: item.get("total", 0) for name, item in sources.items()}
        before_counts = dict(counts)
        after_counts = dict(counts)
        if before is not None:
            before_counts.update(before)
        if after is not None:
            after_counts.update(after)
        return evaluate_run(
            summary,
            before_counts=before_counts,
            after_counts=after_counts,
            validation_sources=validation,
            catalog_total=catalog,
        )

    def test_healthy_full_run_passes_and_prints_deltas(self) -> None:
        fails, lines = self._check(self._stores())
        self.assertEqual(fails, [])
        self.assertTrue(any(line.startswith("  Δ swappie:") for line in lines))
        self.assertTrue(any("Catálogo merge: 800" in line for line in lines))

    def test_zero_ipads_fails_full_even_when_iphones_exist(self) -> None:
        sources = self._stores()
        sources["certideal"] = {
            "total": 118,
            "errors": 0,
            "by_category": {"iphones": 118, "ipads": 0},
            "warnings": ["ipads: 0 produtos guardados"],
        }
        fails, lines = self._check(sources)
        self.assertIn("certideal: 0 iPads no full", fails)
        self.assertTrue(any(line.startswith("::error::certideal: 0 iPads") for line in lines))

    def test_zero_ipads_in_incremental_does_not_fail(self) -> None:
        sources = self._stores()
        sources["certideal"]["by_category"]["ipads"] = 0
        fails, _lines = self._check(sources, mode="incremental")
        self.assertNotIn("certideal: 0 iPads no full", fails)

    def test_callphone_fatal_error_fails_and_zero_total_fails_full(self) -> None:
        sources = self._stores()
        sources["callphone"] = {
            "total": 0,
            "errors": 1,
            "fatal_error": "HTTP 429 após 5 tentativas",
            "by_category": {},
        }
        fails, lines = self._check(sources)
        self.assertTrue(any(item.startswith("callphone: fatal_error") for item in fails))
        self.assertTrue(any("::error::callphone fatal_error:" in line for line in lines))

        sources["callphone"] = {"total": 0, "errors": 0, "by_category": {}}
        fails, lines = self._check(sources, before={"callphone": None})
        self.assertIn("callphone: 0 produtos", fails)
        self.assertTrue(any(line == "::error::callphone: 0 produtos" for line in lines))

    def test_store_falling_to_zero_fails_in_both_modes(self) -> None:
        sources = self._stores()
        for mode in ("full", "incremental"):
            fails, lines = self._check(sources, mode=mode, after={"swappie": 0})
            self.assertIn("swappie: 86 → 0 ofertas", fails)
            self.assertTrue(any("tinha 86 ofertas e veio a 0" in line for line in lines))

    def test_drop_above_80_percent_fails_only_in_full(self) -> None:
        sources = self._stores()
        fails, lines = self._check(sources, after={"swappie": 10})
        self.assertTrue(any(item.startswith("swappie: queda de ") for item in fails))
        self.assertTrue(any(line.startswith("::error::swappie: queda de ") for line in lines))

        fails, lines = self._check(sources, mode="incremental", after={"swappie": 10})
        self.assertFalse(any(item.startswith("swappie: queda de ") for item in fails))
        self.assertTrue(any(line.startswith("::warning::swappie: queda de ") for line in lines))
        self.assertTrue(any("modo incremental" in line for line in lines))

    def test_drop_of_exactly_80_percent_is_allowed(self) -> None:
        sources = self._stores()
        # 100 → 20 é exactamente 80%, e o limite é «mais de 80%».
        sources["swappie"] = {"total": 100, "errors": 0, "by_category": {}}
        fails, _lines = self._check(
            sources,
            before={"swappie": 100},
            after={"swappie": 20},
        )
        self.assertFalse(any("queda" in item for item in fails))

    def test_live_block_warns_without_failing(self) -> None:
        fails, lines = self._check(
            self._stores(),
            validation={
                "swappie": {
                    "live_checked": 10,
                    "live_failed": 10,
                    "live_check_stopped": True,
                    "live_removal_aborted": False,
                }
            },
        )
        self.assertEqual(fails, [])
        self.assertTrue(any(line.startswith("::warning::swappie: verificação live") for line in lines))
        self.assertTrue(any("ofertas mantidas" in line for line in lines))

    def test_missing_or_small_catalog_fails_before_publish(self) -> None:
        fails, lines = self._check(self._stores(), catalog=None)
        self.assertTrue(fails)
        self.assertTrue(any("all_products.json em falta" in line for line in lines))

        fails, lines = self._check(self._stores(), catalog=120)
        self.assertTrue(any("abaixo de 400" in item for item in fails))
        self.assertTrue(any(line.startswith("::error::all_products") for line in lines))


class WorkflowOrderTests(unittest.TestCase):
    def test_summary_check_runs_before_data_commit(self) -> None:
        workflow = (_ROOT / ".github" / "workflows" / "scrape-daily.yml").read_text(encoding="utf-8")
        verify_at = workflow.index("run: python scrapers/check_run_summary.py")
        commit_at = workflow.index("- name: Commit dados actualizados")
        self.assertLess(verify_at, commit_at)
        self.assertNotIn("<<'PY'", workflow)
        self.assertIn("callphone", ( _SCRAPERS_DIR / "check_run_summary.py").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
