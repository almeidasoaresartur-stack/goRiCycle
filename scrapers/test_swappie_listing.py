"""Listagem Swappie sem browser remoto: os cartões deixaram de usar ModelCard__*.

Cobre os dois markups vistos em Nov 2026 (iPhone com __ProductName dentro do <a>,
iPad com h2/__Title e link StretchedAnchor) e o fallback FullHeightModelCard.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from playwright.sync_api import sync_playwright

from swappie_scraper import collect_model_cards

IPHONE_HTML = """
<main>
  <ul>
    <li data-testid="model-card-container">
      <a href="/pt/modelo/iphone-14/" class="CategoryPage__FullHeightModelCard-abc">
        <div class="_DefaultVariant__ImageContainer-x">
          <img src="https://assets.swappie.com/cdn-cgi/image/width=240/iphone-14.png" alt="iPhone 14">
        </div>
        <div class="_DefaultVariant__ProductName-y">iPhone 14</div>
        <div class="_DefaultVariant__BadgesContainer-z">
          <div class="Badge__BaseBadge-a">128 GB</div>
          <div class="Badge__BaseBadge-a">256 GB</div>
          <div class="Badge__BaseBadge-a">512 GB (Esgotado)</div>
        </div>
        <div class="_DefaultVariant__Price-w">325,00 €</div>
        <span class="LaunchPrice__LaunchPriceTextContainer">Preço de lançamento da Apple: 1 029 €</span>
      </a>
    </li>
    <li data-testid="model-card-container">
      <a href="/pt/modelo/iphone-se-2020/" class="CategoryPage__FullHeightModelCard-abc">
        <div class="_DefaultVariant__ProductName-y">iPhone SE 2020</div>
        <div class="_DefaultVariant__BadgesContainer-z">
          <div class="Badge__BaseBadge-a">64 GB (Esgotado)</div>
          <div class="Badge__BaseBadge-a">128 GB (Esgotado)</div>
        </div>
        <div class="_DefaultVariant__Price-w">239,00 €</div>
      </a>
    </li>
  </ul>
  <footer>
    <a class="FooterList__FooterLink" href="/pt/modelo/macbook-air-m3-13/">MacBook Air M3 13</a>
  </footer>
</main>
"""

IPAD_HTML = """
<main>
  <ul>
    <li data-testid="model-card-container">
      <div class="DeviceCategoryPage__FullHeightModelCard-sc _DefaultVariant__CardFrame-sc">
        <div class="_DefaultVariant__ImageContainer-sc">
          <img src="https://assets.swappie.com/ipad-air.png" alt="iPad Air">
        </div>
        <h2 class="Typography__LabelProminentLarge _DefaultVariant__Title-sc">iPad Air 7 (2025) 11″ recondicionado</h2>
        <span class="_DefaultVariant__PropertyChipRoot-sc"><span class="property-chip-label">128 GB</span></span>
        <span class="_DefaultVariant__PropertyChipRoot-sc"><span class="property-chip-label">512 GB (Esgotado)</span></span>
        <a href="/pt/modelo/ipad-air-7-2025-11/" aria-label="iPad Air 7 (2025) 11″" class="_DefaultVariant__StretchedAnchor-sc">Ver</a>
        <span class="_DefaultVariant__Price-sc">639 €</span>
      </div>
    </li>
  </ul>
</main>
"""

ANCHOR_ONLY_HTML = """
<main>
  <a href="/pt/modelo/iphone-13/" class="CategoryPage__FullHeightModelCard-hash">
    <div class="_DefaultVariant__ProductName-x">iPhone 13</div>
    <div class="_DefaultVariant__BadgesContainer-y"><div class="Badge__BaseBadge">128 GB</div></div>
    <div class="_DefaultVariant__Price-z">269,00 €</div>
  </a>
</main>
"""

OLD_SELECTOR = (
    "a:has([class*='ModelCard__ProductName']), [class*='ModelCard2025__CardFrame']"
)


class SwappieListingTests(unittest.TestCase):
    def _cards(self, html: str) -> list[dict]:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page()
            page.set_content(html)
            old_hits = page.locator(OLD_SELECTOR).count()
            self.assertEqual(old_hits, 0, "o markup novo não pode depender do selector antigo")
            with patch("swappie_scraper.page_wait_ms"):
                cards = collect_model_cards(page, "https://swappie.com")
            browser.close()
        return cards

    def test_iphone_cards_skip_footer_and_fully_sold_out(self) -> None:
        cards = self._cards(IPHONE_HTML)
        self.assertEqual([card["model"] for card in cards], ["iPhone 14"])
        card = cards[0]
        self.assertEqual(card["url"], "https://swappie.com/pt/modelo/iphone-14/")
        self.assertEqual(card["listing_price"], 325.0)
        self.assertEqual(card["storages_hint"], ["128GB", "256GB", "512GB"])
        self.assertIn("iphone-14.png", card["image_url"])

    def test_ipad_card_uses_title_and_stretched_anchor(self) -> None:
        cards = self._cards(IPAD_HTML)
        self.assertEqual(len(cards), 1)
        card = cards[0]
        self.assertEqual(card["model"], "iPad Air 7 (2025) 11″")
        self.assertEqual(card["url"], "https://swappie.com/pt/modelo/ipad-air-7-2025-11/")
        self.assertEqual(card["listing_price"], 639.0)
        self.assertEqual(card["storages_hint"], ["128GB", "512GB"])

    def test_full_height_anchor_fallback_without_testid(self) -> None:
        cards = self._cards(ANCHOR_ONLY_HTML)
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["model"], "iPhone 13")
        self.assertEqual(cards[0]["listing_price"], 269.0)


if __name__ == "__main__":
    unittest.main()
