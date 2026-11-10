"""Telemóveis novos da Callphone não entram no catálogo de recondicionados."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from callphone_scraper import GRADE_MAP, is_brand_new_retail, is_valid_product


class CallphoneNewRetailTests(unittest.TestCase):
    def test_grade_map_does_not_treat_new_as_premium(self) -> None:
        self.assertNotIn("novo", GRADE_MAP)
        self.assertNotIn("new", GRADE_MAP)
        self.assertEqual(GRADE_MAP["premium"], "Premium")

    def test_rejects_new_handle(self) -> None:
        product = {
            "title": "iPhone 18 Pro Max 256GB",
            "handle": "iphone-18-pro-max-256gb-novo",
            "product_type": "iPhone",
            "tags": [],
        }
        self.assertTrue(is_brand_new_retail(product))
        self.assertFalse(is_valid_product(product))

    def test_rejects_novo_in_title(self) -> None:
        product = {
            "title": "iPhone 17 Novo",
            "handle": "iphone-17-novo",
            "product_type": "",
            "tags": ["novo"],
        }
        self.assertFalse(is_valid_product(product))

    def test_keeps_refurbished_and_como_novo(self) -> None:
        refurbished = {
            "title": "iPhone 16 Pro 128GB",
            "handle": "iphone-16-pro-128gb",
            "product_type": "iPhone",
            "tags": ["recondicionado"],
        }
        como_novo = {
            "title": "iPhone 13 Como Novo",
            "handle": "iphone-13-como-novo",
            "product_type": "",
            "tags": [],
        }
        semi = {
            "title": "iPhone 12 semi-novo",
            "handle": "iphone-12-semi-novo",
            "product_type": "",
            "tags": "semi-novo",
        }
        self.assertTrue(is_valid_product(refurbished))
        self.assertFalse(is_brand_new_retail(como_novo))
        self.assertTrue(is_valid_product(como_novo))
        self.assertFalse(is_brand_new_retail(semi))
        self.assertTrue(is_valid_product(semi))


if __name__ == "__main__":
    unittest.main()
