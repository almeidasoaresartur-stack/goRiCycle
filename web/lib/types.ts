export type NormalizedGrade = "Premium" | "Excelente" | "Muito Bom" | "Bom";

export type ProductSource = "iservices" | "refurbed" | "swappie" | "certideal" | "callphone";

export type ScrapedProduct = {
  source: ProductSource;
  scraped_at: string;
  product_id: string;
  category: string;
  brand: string | null;
  model: string;
  storage: string | null;
  color: string | null;
  grade: string | null;
  price: number;
  original_price: number | null;
  currency: string;
  warranty_months: number;
  url: string;
  image_url: string | null;
  source_page: string;
  affiliate_enabled: boolean;
  affiliate_network: string | null;
};

export type ProductsFile = {
  source: string;
  scraped_at: string;
  total_products: number;
  products: ScrapedProduct[];
};
