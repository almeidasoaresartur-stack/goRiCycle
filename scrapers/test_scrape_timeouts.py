"""Testes do carrossel Refurbed e do limite por scraper (sem browser)."""

from __future__ import annotations

import signal
import subprocess
import sys
import unittest
from pathlib import Path

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

import run_all
from refurbed_scraper import (
    ProductExtractionBudget,
    ProductExtractionTimeout,
    cheapest_per_storage,
    records_from_carousel_items,
)


class CarouselOfferTests(unittest.TestCase):
    def _records(self, items: list[dict]) -> list[dict]:
        return records_from_carousel_items(
            category="iphones",
            model="iPhone 15",
            product_url="https://www.refurbed.pt/p/iphone-15/",
            image_url=None,
            source_page="https://www.refurbed.pt/c/iphones/",
            scraped_at="2026-10-07T00:00:00+00:00",
            items=items,
            original_price=849.0,
            seller_rating=4.6,
        )

    def test_keeps_total_prices_and_drops_deltas_and_financing(self) -> None:
        records = self._records(
            [
                {"storage": "128 GB", "grade": "Excelente", "price": "438,99 €", "color": "preto"},
                {"storage": "256 GB", "grade": "Muito bom", "price": "-84 €", "color": None},
                {"storage": "128 GB", "grade": "Bom", "price": "12,99 € / mês", "color": None},
                {"storage": "256 GB", "grade": "Bom", "price": "496,99 €", "color": "azul"},
            ]
        )
        by_storage = {record["storage"]: record["price"] for record in records}
        self.assertEqual(by_storage, {"128GB": 438.99, "256GB": 496.99})
        self.assertTrue(all(record["url"].rstrip("/").endswith("/p/iphone-15") for record in records))

    def test_cheapest_per_storage(self) -> None:
        records = self._records(
            [
                {"storage": "128 GB", "grade": "Excelente", "price": "498,99 €", "color": None},
                {"storage": "128 GB", "grade": "Bom", "price": "423,99 €", "color": None},
                {"storage": "512 GB", "grade": "Excelente", "price": "604,99 €", "color": None},
            ]
        )
        kept = cheapest_per_storage(records)
        prices = sorted(record["price"] for record in kept)
        self.assertEqual(prices, [423.99, 604.99])
        cheap_128 = next(record for record in kept if record["storage"] == "128GB")
        self.assertEqual(cheap_128["grade"], "Bom")


class TimeoutGuardTests(unittest.TestCase):
    def test_budget_does_not_arm_sigalrm(self) -> None:
        previous = signal.getsignal(signal.SIGALRM)
        budget = ProductExtractionBudget(30, "iPhone 15")
        budget.check("antes da ficha")
        self.assertEqual(signal.getsignal(signal.SIGALRM), previous)
        self.assertEqual(signal.alarm(0), 0)

    def test_budget_raises_when_expired(self) -> None:
        budget = ProductExtractionBudget(-1, "iPhone 15")
        with self.assertRaises(ProductExtractionTimeout):
            budget.check("ficha")

    def test_stop_process_group_kills_session(self) -> None:
        proc = subprocess.Popen(
            [sys.executable, "-c", "import time; time.sleep(60)"],
            start_new_session=True,
        )
        run_all._stop_process_group(proc)
        self.assertIsNotNone(proc.poll())
        self.assertNotEqual(proc.returncode, 0)

    def test_bounded_runner_kills_hung_scraper(self) -> None:
        original_timeouts = dict(run_all.SOURCE_TIMEOUT_SEC)
        real_popen = run_all.subprocess.Popen

        def hanging_popen(command, **kwargs):
            return real_popen(
                [sys.executable, "-c", "import time; time.sleep(60)"],
                **kwargs,
            )

        run_all.SOURCE_TIMEOUT_SEC["iservices"] = 1
        run_all.subprocess.Popen = hanging_popen
        try:
            stats = run_all.run_source_bounded("iservices", "incremental", None)
        finally:
            run_all.subprocess.Popen = real_popen
            run_all.SOURCE_TIMEOUT_SEC.clear()
            run_all.SOURCE_TIMEOUT_SEC.update(original_timeouts)

        self.assertIn("Timeout 1s", stats["fatal_error"])
        self.assertEqual(stats["total"], 0)


if __name__ == "__main__":
    unittest.main()
