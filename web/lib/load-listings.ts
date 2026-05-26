import {
  aggregateListings,
  filterAggregatedProducts,
  filterListings,
  scraperProductToListing,
  type AggregatedProduct,
  type MarketplaceFilters,
  type ProductListing,
} from "./marketplace";
import { ACTIVE_SOURCES, loadAllScrapedProducts, getScraperCatalogMeta } from "./scraper-data";

export { ACTIVE_SOURCES, getScraperCatalogMeta };

function loadAllListings(): ProductListing[] {
  const listings: ProductListing[] = [];

  for (const product of loadAllScrapedProducts()) {
    const listing = scraperProductToListing(product);
    if (listing) listings.push(listing);
  }

  return listings.sort((a, b) => a.price - b.price);
}

export function getAllListings(): ProductListing[] {
  return loadAllListings();
}

export function getAllAggregatedProducts(): AggregatedProduct[] {
  return aggregateListings(loadAllListings());
}

export function getMarketplaceResults(filters: MarketplaceFilters): {
  products: AggregatedProduct[];
  total: number;
} {
  const all = getAllAggregatedProducts();
  const products = filterAggregatedProducts(all, filters);
  return { products, total: products.length };
}

export function getMarketplaceListings(filters: MarketplaceFilters): {
  listings: ProductListing[];
  total: number;
} {
  const all = loadAllListings();
  const listings = filterListings(all, filters);
  return { listings, total: listings.length };
}
