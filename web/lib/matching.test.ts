import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { modelMatches } from "./model-matching";
import { getListingsForProductSlug, getProductSlugRedirect } from "./product-pages";
import { cleanBaseModel } from "./product-display";
import { isNewRetailProduct } from "./scraper-data";
import { slugify } from "./slugify";

describe("cleanBaseModel — sufixo e", () => {
  it("separa 16e, 17e e S10e do modelo base", () => {
    assert.equal(cleanBaseModel("iPhone 16e"), "iPhone 16e");
    assert.equal(cleanBaseModel("iPhone 16E"), "iPhone 16e");
    assert.equal(cleanBaseModel("iPhone 16e esim"), "iPhone 16e");
    assert.equal(cleanBaseModel("iPhone 17E 256GB"), "iPhone 17e");
    assert.equal(cleanBaseModel("iPhone 17e"), "iPhone 17e");
    assert.equal(cleanBaseModel("Samsung Galaxy S10e"), "Galaxy S10e");
  });

  it("não trata esim nem a cor «e sable» como edição e", () => {
    assert.equal(cleanBaseModel("iPhone 16 esim"), "iPhone 16");
    assert.equal(cleanBaseModel("iPhone 16 ado esim"), "iPhone 16");
    assert.equal(cleanBaseModel("iPhone 16 Pro e sable"), "iPhone 16 Pro");
    assert.equal(cleanBaseModel("iPhone 16 Pro Max e sable"), "iPhone 16 Pro Max");
    assert.equal(cleanBaseModel("iPhone 16 Pro Max"), "iPhone 16 Pro Max");
    assert.equal(cleanBaseModel("iPhone 16 Plus"), "iPhone 16 Plus");
  });

  it("normaliza Samsung A17 para Galaxy A17", () => {
    assert.equal(cleanBaseModel("Samsung A17 128GB"), "Samsung Galaxy A17");
    assert.equal(cleanBaseModel("Samsung Galaxy A17"), "Samsung Galaxy A17");
    assert.equal(cleanBaseModel("Samsung S26 Ultra 256GB"), "Galaxy S26 Ultra");
    assert.equal(cleanBaseModel("Samsung Galaxy S23 FE"), "Galaxy S23 FE");
    assert.equal(cleanBaseModel("Samsung Galaxy S22 Plus"), "Galaxy S22 Plus");
    assert.equal(cleanBaseModel("Samsung Galaxy S24 Ultra"), "Galaxy S24 Ultra");
  });

  it("gera slugs distintos para 16 e 16e", () => {
    assert.equal(slugify("iPhone 16", "128GB"), "iphone-16-128gb-recondicionado");
    assert.equal(slugify("iPhone 16e", "128GB"), "iphone-16e-128gb-recondicionado");
    assert.equal(slugify("Samsung Galaxy S10e", "128GB"), "galaxy-s10e-128gb-recondicionado");
  });
});

describe("slugs de iPad 11 e 13", () => {
  it("separa Air/Pro 2024-2026 e junta nomes equivalentes", () => {
    assert.equal(
      slugify("iPad Air (2024) | 11\"", "128GB"),
      "ipad-air-2024-11-128gb-recondicionado",
    );
    assert.equal(
      slugify("iPad Air (2024) | 13\"", "128GB"),
      "ipad-air-2024-13-128gb-recondicionado",
    );
    assert.equal(
      slugify("iPad Air 6 (2024) 11″", "128GB"),
      slugify("iPad Air (2024) | 11\"", "128GB"),
    );
    assert.equal(
      slugify("iPad Air 11\" 2024 (6ª Geração)", null),
      "ipad-air-2024-11-recondicionado",
    );
    assert.equal(
      slugify("iPad Pro (2024) | 13\"", "256GB"),
      slugify("iPad Pro (2024) 13″", "256GB"),
    );
    assert.equal(
      slugify("iPad Pro (2025) | 11\"", "256GB"),
      "ipad-pro-2025-11-256gb-recondicionado",
    );
    assert.equal(
      slugify("iPad Air (2026) | 13\"", "128GB"),
      "ipad-air-2026-13-128gb-recondicionado",
    );
  });

  it("não muda slugs de iPad que já distinguiam o tamanho ou tinham um só", () => {
    assert.equal(slugify("iPad 10 (2022) | 10.9\"", "64GB"), "ipad-10-64gb-recondicionado");
    assert.equal(slugify("iPad 11 (2025) | 10.9\"", "128GB"), "ipad-11-128gb-recondicionado");
    assert.equal(slugify("iPad 11 (2025) 11″", "128GB"), "ipad-11-128gb-recondicionado");
    assert.equal(slugify("iPad Pro (2020) 11″", "128GB"), "ipad-pro-2020-11-128gb-recondicionado");
    assert.equal(slugify("iPad Pro (2020) 12.9″", "128GB"), "ipad-pro-2020-129-128gb-recondicionado");
    assert.equal(slugify("iPad Pro (2018) | 11.0\"", "64GB"), "ipad-pro-2018-64gb-recondicionado");
    assert.equal(slugify("iPad Air 4 (2020) 10.9″", "64GB"), "ipad-air-4-64gb-recondicionado");
    assert.equal(slugify("iPad Mini 6 (2021) 8.3″", "64GB"), "ipad-mini-6-64gb-recondicionado");
    assert.equal(slugify("iPad Pro 11\" 2021 (3ª Geração)", null), "ipad-pro-11-recondicionado");
  });
});

describe("modelMatches", () => {
  it("recusa 16e no lugar do 16 e S10e no lugar do S10", () => {
    assert.equal(modelMatches("iPhone 16e", "iPhone 16"), false);
    assert.equal(modelMatches("iPhone 16", "iPhone 16e"), false);
    assert.equal(modelMatches("iPhone 16 esim", "iPhone 16"), true);
    assert.equal(modelMatches("Galaxy S10e", "Galaxy S10"), false);
    assert.equal(modelMatches("iPhone 16e", "iPhone 16e"), true);
  });

  it("não mistura 11\" com 13\"", () => {
    assert.equal(
      modelMatches("iPad Air (2024) | 13\"", "iPad Air (2024) 11\""),
      false,
    );
    assert.equal(
      modelMatches("iPad Air 6 (2024) 11″", "iPad Air (2024) 11\""),
      true,
    );
    assert.equal(modelMatches("iPad 11 (2025) 11″", "iPad 11"), true);
    assert.equal(modelMatches("iPad 11 (2025) | 10.9\"", "iPad 11"), true);
  });
});

describe("catálogo", () => {
  it("tira o 16e da página do iPhone 16 128GB", () => {
    const listings = getListingsForProductSlug("iphone-16-128gb-recondicionado");
    assert.ok(listings.length > 0);
    assert.equal(
      listings.some((listing) => /16e/i.test(`${listing.model} ${listing.url}`)),
      false,
    );
    assert.equal(listings[0]?.price, 586.99);
    assert.equal(getProductSlugRedirect("iphone-16-128gb-recondicionado"), null);
  });

  it("redirecciona slugs que ficaram vazios", () => {
    assert.equal(
      getProductSlugRedirect("galaxy-s10-128gb-recondicionado"),
      "/produto/galaxy-s10e-128gb-recondicionado",
    );
    assert.equal(
      getProductSlugRedirect("ipad-air-2024-128gb-recondicionado"),
      "/produto/ipad-air-2024-11-128gb-recondicionado",
    );
    assert.equal(
      getProductSlugRedirect("samsung-a17-128gb-recondicionado"),
      "/produto/samsung-galaxy-a17-128gb-recondicionado",
    );
    assert.equal(
      getProductSlugRedirect("iphone-18-pro-max-256gb-recondicionado"),
      "/marca/apple",
    );
    assert.equal(getProductSlugRedirect("ipad-pro-2024-11-256gb-recondicionado"), null);
  });

  it("não deixa telemóveis novos na página do 17 Pro", () => {
    const listings = getListingsForProductSlug("iphone-17-pro-256gb-recondicionado");
    assert.equal(
      listings.some((listing) => /-novo(?:[/?#]|$)/i.test(listing.url)),
      false,
    );
  });
});

describe("isNewRetailProduct", () => {
  it("exclui novos da Callphone e mantém recondicionados", () => {
    assert.equal(
      isNewRetailProduct({
        url: "https://callphone.pt/products/iphone-18-pro-max-256gb-novo?variant=1",
        model: "iPhone 18 Pro Max 256GB",
      }),
      true,
    );
    assert.equal(
      isNewRetailProduct({
        url: "https://callphone.pt/products/iphone-17-novo?variant=1",
        model: "iPhone 17 256GB",
      }),
      true,
    );
    assert.equal(
      isNewRetailProduct({
        url: "https://callphone.pt/products/iphone-16-pro-128gb?variant=1",
        model: "iPhone 16 Pro 128GB",
      }),
      false,
    );
    assert.equal(
      isNewRetailProduct({
        url: "https://callphone.pt/products/iphone-13-como-novo",
        model: "iPhone 13 Como Novo",
      }),
      false,
    );
    assert.equal(
      isNewRetailProduct({
        url: "https://example.pt/products/iphone-13-semi-novo",
        model: "iPhone 13 semi-novo",
      }),
      false,
    );
  });
});
