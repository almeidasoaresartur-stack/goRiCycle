import { getBlogPost, type BlogPost } from "./blog";
import type { ProductListing, TechType } from "./marketplace";
import { resolveProductBrand } from "./marketplace";
import {
  buildProductSlugIndexationMap,
  formatProductPageName,
  listingProductSlug,
  loadAllProducts,
} from "./product-pages";
import { canonicalPath } from "./seo";

export const HUB_PRODUCT_LIMIT = 48;

export const BRAND_HUB_SLUGS = ["apple", "samsung"] as const;
export type BrandHubSlug = (typeof BRAND_HUB_SLUGS)[number];

export type HubKind = "category" | "brand";

export type HubId = "smartphones" | "tablets" | "apple" | "samsung";

export type HubFilters = {
  tech?: TechType;
  brand?: string;
};

export type HubConfig = {
  id: HubId;
  kind: HubKind;
  path: string;
  label: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  filters: HubFilters;
  relatedBlogSlugs: string[];
  marketplaceHref: string;
  sitemapPriority: number;
  intro: string[];
};

export type HubProduct = {
  slug: string;
  href: string;
  name: string;
  price: number;
  brand: string | null;
  tech: TechType;
  model: string;
  storage: string | null;
  imageUrl: string | null;
  storeCount: number;
  offerCount: number;
};

export type HubCatalog = {
  products: HubProduct[];
  totalModels: number;
  totalOffers: number;
};

export const HUBS: HubConfig[] = [
  {
    id: "smartphones",
    kind: "category",
    path: "/smartphones",
    label: "Smartphones",
    title: "Smartphones recondicionados em Portugal",
    metaTitle: "Smartphones recondicionados — compara preços em Portugal | goRiCycle",
    metaDescription:
      "Compara iPhone, Samsung Galaxy e Google Pixel recondicionados nas lojas portuguesas. Modelos indexáveis, ordenados por preço, com garantia.",
    filters: { tech: "smartphones" },
    relatedBlogSlugs: [
      "iphone-13-vale-a-pena-2026",
      "iphone-15-vs-iphone-16-recondicionado",
      "garantia-bateria-recondicionados-comparacao-lojas",
    ],
    marketplaceHref: "/?tech=smartphones&view=all&section=comparador#comparador",
    sitemapPriority: 0.85,
    intro: [
      "Comprar um smartphone recondicionado em Portugal deixou de ser um atalho arriscado. Para muita gente, é hoje a forma mais racional de ter um telemóvel recente — iPhone, Galaxy ou Pixel — sem pagar o preço de lançamento. O goRiCycle compara ofertas das lojas parceiras (Certideal, iServices, Swappie, Refurbed e Callphone) e mostra o melhor preço para o mesmo modelo, capacidade e estado.",
      "O que muda num recondicionado não é o hardware de origem: é o percurso. O aparelho foi inspeccionado, testado e, quando necessário, reparado. Na hora de decidir, o que realmente conta é o grau estético, a saúde da bateria, a garantia escrita e o preço. Um Grau A ou Excelente pode parecer quase novo; um Bom Estado chega para quem aceita marcas de uso a troco de poupar dezenas de euros. Nenhuma destas etiquetas substitui a percentagem de bateria — pede sempre o número exacto na ficha do produto.",
      "No catálogo português, a Apple continua a dominar em volume. Há mais iPhones a entrar em trade-in todos os anos, o valor residual aguenta-se melhor e as lojas têm processos mais maduros para esta linha. Isso não significa que um Galaxy S23 ou um Pixel 8 sejam piores compras. Em recondicionado, um Android de gama alta custa frequentemente menos do que o iPhone equivalente e, nas gerações recentes, a promessa de actualizações já não é o fosso que era há cinco anos.",
      "A capacidade de armazenamento pesa mais do que parece no anúncio. 128 GB chega para a maioria das pessoas; 256 GB faz sentido se gravas muito vídeo, descarregas conteúdo offline ou evitas a nuvem. No mercado recondicionado o prémio por cada salto de GB costuma ser menor do que no produto novo, mas a diferença continua a existir. Compara sempre o mesmo modelo com a mesma capacidade — um iPhone 14 de 128 GB e outro de 256 GB não são o mesmo produto, mesmo que o nome comercial seja parecido.",
      "As lojas também não são intercambiáveis. A Swappie foca-se em iPhone; Certideal e Refurbed cobrem Apple e Android; iServices e Callphone acrescentam outras opções e prazos de garantia distintos. As coberturas vão dos 12 aos 36 meses, e a garantia da bateria nem sempre dura o mesmo que a do aparelho. É por isso que o goRiCycle lista o grau, a loja e o preço lado a lado, em vez de te pedir que abras cinco separadores e faças as contas à mão.",
      "Em baixo estão os smartphones recondicionados mais acessíveis do catálogo — só páginas de produto indexáveis, ordenadas por preço. Se quiseres filtrar por marca, loja ou estado, o comparador tem o catálogo completo com todas as ofertas do dia.",
    ],
  },
  {
    id: "tablets",
    kind: "category",
    path: "/tablets",
    label: "Tablets",
    title: "Tablets recondicionados em Portugal",
    metaTitle: "Tablets recondicionados — iPad e Galaxy Tab em Portugal | goRiCycle",
    metaDescription:
      "Compara iPad e tablets Samsung recondicionados nas lojas portuguesas. Modelos indexáveis, ordenados por preço, com garantia.",
    filters: { tech: "tablets" },
    relatedBlogSlugs: [
      "ipad-11-recondicionado-128gb-256gb-512gb",
      "porque-apple-domina-mercado-recondicionados",
      "comparacao-lojas-certideal-iservices-swappie-refurbed-callphone",
    ],
    marketplaceHref: "/?tech=tablets&view=all&section=comparador#comparador",
    sitemapPriority: 0.85,
    intro: [
      "Um tablet recondicionado é, para muita gente, a compra que mais sentido faz no mercado de segunda mão certificado: usas-o em casa, na mala ou nas aulas, e o desgaste típico — cantos, marca do Pencil, película antiga — pesa menos do que num telemóvel que vai ao bolso todos os dias. No goRiCycle comparamos iPads e tablets Samsung nas lojas parceiras em Portugal, para veres o mesmo modelo e a mesma capacidade lado a lado.",
      "O catálogo é claramente liderado pela Apple. iPad de entrada, Air, Pro e Mini concentram a maior parte das unidades que as lojas recebem em trade-in e devolução. Isso traz duas vantagens práticas: mais graus estéticos à escolha dentro do mesmo modelo, e preços mais fáceis de comparar porque há mais pontos de referência. Um iPad de 10.ª ou 11.ª geração recondicionado cobre navegação, streaming, notas e produtividade ligeira sem precisares de um Air ou Pro.",
      "A capacidade é a decisão que mais gente erra. 128 GB chega se o tablet é para browser, YouTube, PDFs e umas dezenas de apps. 256 GB começa a justificar-se com Apple Pencil no dia-a-dia, digitalizações, apontamentos com imagem ou séries descarregadas para viagem. 512 GB só compensa se editas vídeo no aparelho ou acumulas ficheiros grandes. No recondicionado o salto de preço entre capacidades é muitas vezes mais pequeno do que no novo — mas continua a ser dinheiro a mais se nunca fores encher o disco.",
      "Há diferenças que a capacidade não compra. Face ID, ecrã ProMotion a 120 Hz, Apple Intelligence e compatibilidade com o Pencil de 2.ª geração estão reservados a certas linhas Air e Pro. Comprar o iPad de entrada com mais armazenamento não te dá nenhuma destas coisas. Se o Pencil ou o ecrã fluido são essenciais, sobe de gama; se não são, não pagues o prémio.",
      "Os Galaxy Tab aparecem em menor volume, mas fazem sentido quando o orçamento é o critério principal ou quando já vives no ecossistema Android. A oferta flutua mais de semana para semana do que a de iPad, por isso o preço do dia importa: o mesmo Tab pode variar dezenas de euros entre lojas. Confirma sempre o grau, a garantia e se a unidade é Wi-Fi ou celular — são produtos diferentes com preços diferentes.",
      "A grelha abaixo mostra os tablets recondicionados mais acessíveis com página de produto indexável, ordenados por preço. Para filtrar por marca, loja ou estado, abre o comparador com o catálogo completo.",
    ],
  },
  {
    id: "apple",
    kind: "brand",
    path: "/marca/apple",
    label: "Apple",
    title: "Apple recondicionada em Portugal — iPhone e iPad",
    metaTitle: "Apple recondicionada — iPhone e iPad em Portugal | goRiCycle",
    metaDescription:
      "Compara iPhone e iPad recondicionados nas lojas portuguesas. Modelos Apple indexáveis, ordenados por preço, com garantia.",
    filters: { brand: "Apple" },
    relatedBlogSlugs: [
      "porque-apple-domina-mercado-recondicionados",
      "iphone-13-vale-a-pena-2026",
      "ipad-11-recondicionado-128gb-256gb-512gb",
    ],
    marketplaceHref: "/?brand=Apple&view=all&section=comparador#comparador",
    sitemapPriority: 0.8,
    intro: [
      "Se já procuraste tech recondicionada em Portugal, reparaste no óbvio: o catálogo é sobretudo Apple. Não é uma preferência editorial do goRiCycle — é o mercado. iPhones e iPads entram em maior volume nos circuitos de trade-in, perdem valor mais devagar e recebem actualizações de sistema durante mais anos do que a média Android da mesma idade. Por isso as lojas parceiras (Certideal, iServices, Swappie, Refurbed e Callphone) concentram aqui a maior parte da oferta.",
      "Essa densidade é boa para quem compra. Há mais graus estéticos dentro do mesmo modelo, mais capacidades em stock e preços mais previsíveis de comparar. Um iPhone 13, 14 ou 15 de 128 GB aparece em várias lojas no mesmo dia; a diferença entre a oferta mais cara e a mais barata chega facilmente aos 40 ou 80 euros. O mesmo se aplica ao iPad de entrada e ao Air. O trabalho do goRiCycle é pôr essas ofertas na mesma grelha, com o mesmo nome de modelo e a mesma capacidade.",
      "Apple recondicionada não é automaticamente a melhor escolha. Faz sentido se já estás no ecossistema (Mac, Watch, AirPods), se queres um aparelho que ainda receba iOS ou iPadOS durante anos, ou se planeias voltar a vender e te importa o valor residual. Faz menos sentido se o orçamento é curto e um Galaxy ou Pixel de gama alta te dá o que precisas por menos, ou se não tens nenhum investimento na Apple e não vês vantagem em entrar agora.",
      "Dentro da própria Apple, a geração certa depende do uso — não do número mais alto. O iPhone 13 continua a ser uma porta de entrada sólida em 2026 para uso quotidiano, com a ressalva do Lightning e da ausência de Apple Intelligence. O 15 traz USB-C e câmara de 48 MP a um preço já de recondicionado. O 16 (e o 15 Pro) são a linha em que a IA nativa da Apple entra na conversa. Nos tablets, o iPad de 11.ª geração cobre a maior parte das pessoas; Air e Pro só compensam se o Pencil, o ecrã a 120 Hz ou a edição de vídeo forem o motivo da compra.",
      "Dois detalhes que as pessoas saltam e depois lamentam: a bateria e a loja. «Excelente» descreve o aspecto, não a percentagem de carga. A cobertura da bateria pode ser mais curta do que a garantia do aparelho — seis meses numa loja, 36 noutra. A Swappie, por exemplo, não vende iPads nem Android. Compara o mesmo iPhone ou iPad entre lojas, confirma a saúde da bateria e lê o prazo real, não só o selo de grau.",
      "Em baixo estão os modelos Apple indexáveis mais acessíveis — iPhone e iPad — ordenados por preço. O comparador tem o catálogo completo se quiseres filtrar por estado, capacidade ou loja.",
    ],
  },
  {
    id: "samsung",
    kind: "brand",
    path: "/marca/samsung",
    label: "Samsung",
    title: "Samsung recondicionada em Portugal — Galaxy",
    metaTitle: "Samsung Galaxy recondicionado em Portugal | goRiCycle",
    metaDescription:
      "Compara smartphones e tablets Samsung Galaxy recondicionados nas lojas portuguesas. Modelos indexáveis, ordenados por preço.",
    filters: { brand: "Samsung" },
    relatedBlogSlugs: [
      "graus-estado-recondicionados-comparacao-lojas",
      "garantia-bateria-recondicionados-comparacao-lojas",
      "comparacao-lojas-certideal-iservices-swappie-refurbed-callphone",
    ],
    marketplaceHref: "/?brand=Samsung&view=all&section=comparador#comparador",
    sitemapPriority: 0.75,
    intro: [
      "A oferta Samsung recondicionada em Portugal é mais fina do que a da Apple, mas é precisamente por isso que comparar lojas vale a pena. Um Galaxy S21, S22 ou S23 pode variar dezenas de euros entre Certideal, Refurbed, iServices e Callphone no mesmo dia — e a Swappie, focada em iPhone, simplesmente não entra nesta conversa. O goRiCycle junta as ofertas Galaxy (telemóveis e, quando existem, tablets) numa só grelha.",
      "Um Galaxy de gama alta recondicionado costuma custar menos do que o iPhone equivalente da mesma geração. Em troca, confirma duas coisas que no iPhone dás mais por adquiridas: quantos anos de actualizações Android e de segurança a Samsung ainda promete para aquele modelo, e qual é a saúde real da bateria. O grau estético (Premium, Excelente, Bom) descreve riscos e marcas, não a autonomia.",
      "A linha S continua a ser a aposta mais fácil de revender e de comparar. Os Fold e Flip aparecem com menos regularidade e pedem mais atenção ao estado da dobradiça e do ecrã flexível — lê a descrição da loja e a garantia. Nos tablets, o Galaxy Tab é uma alternativa ao iPad quando o orçamento manda ou quando já usas Android no telemóvel.",
      "Em baixo estão os modelos Samsung indexáveis mais acessíveis, ordenados por preço. Para filtrar por estado ou loja, abre o comparador com o catálogo completo.",
    ],
  },
];

const HUBS_BY_ID = new Map(HUBS.map((hub) => [hub.id, hub]));
const HUBS_BY_PATH = new Map(HUBS.map((hub) => [hub.path, hub]));

export function getHub(id: HubId): HubConfig {
  const hub = HUBS_BY_ID.get(id);
  if (!hub) throw new Error(`Unknown hub: ${id}`);
  return hub;
}

export function getHubByPath(path: string): HubConfig | undefined {
  return HUBS_BY_PATH.get(path);
}

export function isBrandHubSlug(value: string): value is BrandHubSlug {
  return (BRAND_HUB_SLUGS as readonly string[]).includes(value);
}

export function getBrandHub(slug: string): HubConfig | undefined {
  if (!isBrandHubSlug(slug)) return undefined;
  return HUBS_BY_ID.get(slug);
}

export function techHubPath(tech: TechType): string | null {
  if (tech === "smartphones") return "/smartphones";
  if (tech === "tablets") return "/tablets";
  return null;
}

export function brandHubPath(brand: string | null | undefined): string | null {
  const key = brand?.trim().toLowerCase();
  if (key === "apple") return "/marca/apple";
  if (key === "samsung") return "/marca/samsung";
  return null;
}

export function formatModelosOfertas(models: number, offers: number): string {
  return `${models.toLocaleString("pt-PT")} modelos · ${offers.toLocaleString("pt-PT")} ofertas`;
}

function listingMatchesHub(listing: ProductListing, hub: HubConfig): boolean {
  if (hub.filters.tech && listing.tech !== hub.filters.tech) return false;
  if (hub.filters.brand) {
    const brand = resolveProductBrand(listing);
    if (brand?.toLowerCase() !== hub.filters.brand.toLowerCase()) return false;
  }
  return true;
}

/** Indexable model+storage slugs for a hub, cheapest first, capped for the grid. */
export function getHubCatalog(hub: HubConfig, limit = HUB_PRODUCT_LIMIT): HubCatalog {
  const listings = loadAllProducts().filter((listing) => listing.isAvailable !== false);
  const indexation = buildProductSlugIndexationMap(listings);
  const grouped = new Map<string, ProductListing[]>();

  for (const listing of listings) {
    const slug = listingProductSlug(listing);
    if (!indexation.get(slug)?.indexable) continue;
    if (!listingMatchesHub(listing, hub)) continue;

    const group = grouped.get(slug);
    if (group) group.push(listing);
    else grouped.set(slug, [listing]);
  }

  const allProducts: HubProduct[] = [];
  for (const [slug, group] of grouped) {
    group.sort((a, b) => a.price - b.price);
    const best = group[0];
    if (!best) continue;

    allProducts.push({
      slug,
      href: `/produto/${slug}`,
      name: formatProductPageName(best.model, best.storage),
      price: best.price,
      brand: resolveProductBrand(best),
      tech: best.tech,
      model: best.model,
      storage: best.storage,
      imageUrl: best.imageUrl,
      storeCount: new Set(group.map((item) => item.storeSlug)).size,
      offerCount: group.length,
    });
  }

  allProducts.sort((a, b) => a.price - b.price || a.slug.localeCompare(b.slug));

  return {
    products: allProducts.slice(0, limit),
    totalModels: allProducts.length,
    totalOffers: allProducts.reduce((sum, product) => sum + product.offerCount, 0),
  };
}

export function getRelatedBlogPosts(slugs: string[]): BlogPost[] {
  return slugs
    .map((slug) => getBlogPost(slug))
    .filter((post): post is BlogPost => post != null);
}

export function getRelatedBlogSlugsForListing(listing: ProductListing): string[] {
  const model = listing.model.toLowerCase();
  const brand = (resolveProductBrand(listing) ?? "").toLowerCase();

  if (/iphone\s*se/i.test(model)) {
    return ["iphone-se-2022-recondicionado-2026", "iphone-13-vale-a-pena-2026"];
  }
  if (/iphone\s*1[56]/i.test(model)) {
    return ["iphone-15-vs-iphone-16-recondicionado", "porque-apple-domina-mercado-recondicionados"];
  }
  if (/iphone\s*13/i.test(model)) {
    return ["iphone-13-vale-a-pena-2026", "iphone-15-vs-iphone-16-recondicionado"];
  }
  if (model.includes("ipad")) {
    return [
      "ipad-11-recondicionado-128gb-256gb-512gb",
      "porque-apple-domina-mercado-recondicionados",
    ];
  }
  if (model.includes("pixel")) {
    return [
      "google-pixel-vs-iphone-pro-recondicionado",
      "comparacao-lojas-certideal-iservices-swappie-refurbed-callphone",
    ];
  }
  if (brand === "samsung") {
    return [
      "graus-estado-recondicionados-comparacao-lojas",
      "garantia-bateria-recondicionados-comparacao-lojas",
    ];
  }
  if (listing.tech === "tablets") {
    return [
      "ipad-11-recondicionado-128gb-256gb-512gb",
      "porque-apple-domina-mercado-recondicionados",
    ];
  }
  return [
    "iphone-13-vale-a-pena-2026",
    "comparacao-lojas-certideal-iservices-swappie-refurbed-callphone",
  ];
}

export function getSitemapHubEntries(): { url: string; priority: number }[] {
  return HUBS.map((hub) => ({
    url: canonicalPath(hub.path),
    priority: hub.sitemapPriority,
  }));
}
