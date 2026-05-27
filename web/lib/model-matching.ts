type HighlightProduct = {
  model: string;
  tech: string;
};

export function normalizeModel(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

const IPHONE_VARIANTS = ["pro max", "pro", "mini", "plus"] as const;
const GALAXY_VARIANTS = ["ultra", "plus", "fe"] as const;

function explicitVariants(search: string): string[] {
  const found: string[] = [];
  if (/\bpro max\b/.test(search)) found.push("pro max");
  else if (/\bpro\b/.test(search)) found.push("pro");
  if (/\bmini\b/.test(search)) found.push("mini");
  if (/\bplus\b/.test(search)) found.push("plus");
  if (/\bultra\b/.test(search)) found.push("ultra");
  if (/\bfe\b/.test(search)) found.push("fe");
  return found;
}

function productHasVariant(product: string, variant: string): boolean {
  if (variant === "plus" && /s\d+\+/.test(product)) return true;
  return product.includes(variant);
}

function unwantedVariants(product: string, search: string): boolean {
  const wanted = explicitVariants(search);
  const checkList = search.includes("galaxy") ? GALAXY_VARIANTS : IPHONE_VARIANTS;

  for (const variant of checkList) {
    if (!productHasVariant(product, variant)) continue;
    if (wanted.includes(variant)) continue;
    if (variant === "pro" && wanted.includes("pro max") && product.includes("pro max")) continue;
    return true;
  }
  return false;
}

/** Correspondência estrita de modelo base — variantes isoladas (Pro, Mini, Ultra, etc.). */
export function modelMatches(
  productModel: string | null | undefined,
  searchModel: string | null | undefined,
): boolean {
  const product = normalizeModel(productModel ?? "");
  const search = normalizeModel(searchModel ?? "");
  if (!product || !search) return false;

  if (product === search) return true;

  if (/^iphone\s+\d+$/.test(search)) {
    const base = new RegExp(`^${search.replace(/\s+/g, "\\s+")}(\\s|$)`);
    if (!base.test(product)) return false;
    return !unwantedVariants(product, search);
  }

  if (/^galaxy\s+s\d+$/.test(search)) {
    const base = new RegExp(`^${search.replace(/\s+/g, "\\s+")}(\\s|$|\\+)`);
    if (!base.test(product) && !product.startsWith(`${search} `)) return false;
    return !unwantedVariants(product, search);
  }

  const wanted = explicitVariants(search);
  if (wanted.length > 0) {
    if (!product.includes(search) && !search.split(" ").every((t) => product.includes(t))) {
      return false;
    }
    for (const variant of wanted) {
      if (!productHasVariant(product, variant)) return false;
    }
    return !unwantedVariants(product, search);
  }

  if (product.includes(search)) {
    return !unwantedVariants(product, search);
  }

  const tokens = search.split(" ").filter((t) => t.length > 2);
  if (tokens.length >= 2) {
    const hits = tokens.filter((t) => product.includes(t));
    if (hits.length >= Math.min(3, tokens.length)) {
      return !unwantedVariants(product, search);
    }
  }

  return false;
}

export function queryMatchesModel(productModel: string, query: string): boolean {
  const q = normalizeModel(query);
  if (!q) return true;

  const storageStripped = q.replace(/\d+\s*gb/g, "").trim();
  if (modelMatches(productModel, storageStripped)) return true;

  return modelMatches(productModel, q);
}

export function isRelevantForHighlights(product: HighlightProduct): boolean {
  const model = normalizeModel(product.model ?? "");
  const { tech } = product;

  if (tech === "smartphones") {
    if (model.includes("iphone")) {
      if (/iphone\s*xr?\b/.test(model) || /iphone\s*xs/.test(model)) return false;

      const numbered = model.match(/iphone\s*(\d+)/);
      if (numbered) return parseInt(numbered[1], 10) >= 13;

      if (model.includes("iphone se")) {
        return (
          model.includes("2020") ||
          model.includes("2022") ||
          model.includes("se 2") ||
          model.includes("se 3") ||
          model.includes("(3")
        );
      }

      return false;
    }

    const galaxyS = model.match(/galaxy\s*s(\d+)/);
    if (galaxyS) return parseInt(galaxyS[1], 10) >= 21;

    const pixel = model.match(/pixel\s*(\d+)/);
    if (pixel) return parseInt(pixel[1], 10) >= 6;

    const onePlus = model.match(/oneplus\s*(\d+)/);
    if (onePlus) return parseInt(onePlus[1], 10) >= 9;

    return true;
  }

  if (tech === "tablets") {
    if (model.includes("ipad")) {
      const gen = model.match(/ipad\s*(?:pro|air|mini)?\s*(\d+)/);
      if (gen) return parseInt(gen[1], 10) >= 9;
      return model.includes("m1") || model.includes("m2") || model.includes("m3") || model.includes("m4");
    }
    return true;
  }

  if (tech === "laptops") {
    if (model.includes("macbook")) {
      return /\bm[123]\b/.test(model) || /\bm1\b|\bm2\b|\bm3\b/.test(model);
    }
    if (model.includes("thinkpad")) return true;
    if (model.includes("latitude")) return true;
    return false;
  }

  if (tech === "wearables") {
    if (model.includes("apple watch")) {
      if (model.includes("ultra 2") || model.includes("ultra 3")) return true;

      const series = model.match(/series\s*(\d+)/);
      if (series) return parseInt(series[1], 10) >= 8;

      if (model.includes(" se ") || model.startsWith("apple watch se")) {
        if (model.includes("(2020)")) return false;
        return model.includes("(2023)") || model.includes("(2024)") || model.includes("(2025)");
      }

      return false;
    }
    return true;
  }

  return true;
}

export function normalizeColor(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function colorMatches(
  productColor: string | null | undefined,
  filterColor: string | null | undefined,
): boolean {
  if (!filterColor) return true;
  if (!productColor) return false;

  const product = normalizeColor(productColor);
  const filter = normalizeColor(filterColor);

  const aliases: Record<string, string[]> = {
    preto: ["preto", "black", "meia noite", "midnight", "grafite", "space gray", "space grey"],
    branco: ["branco", "white", "estrela polar", "starlight", "silver white"],
    prata: ["prata", "silver", "starlight"],
    ouro: ["ouro", "gold", "dourado"],
    azul: ["azul", "blue", "sierra", "pacific"],
    verde: ["verde", "green", "alpino", "midnight green"],
    vermelho: ["vermelho", "red", "product red"],
    rosa: ["rosa", "pink", "cor de rosa", "rose"],
    roxo: ["roxo", "purple", "violeta", "purpura", "púrpura"],
    cinzento: ["cinzento", "gray", "grey", "sideral", "grafite", "titanio natural"],
  };

  const filterAliases = aliases[filter] ?? [filter];
  return filterAliases.some((alias) => product.includes(normalizeColor(alias)));
}
