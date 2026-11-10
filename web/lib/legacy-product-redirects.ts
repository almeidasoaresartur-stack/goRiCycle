/**
 * URLs que o agrupamento antigo indexou e que deixam de ter ofertas.
 *
 * - 11" e 13" misturados no mesmo slug: o destino é a página nova com o
 *   preço mínimo mais baixo no catálogo (novembro de 2026).
 * - S10 128GB era só S10e. A17 sem «Galaxy» era o telemóvel novo da Callphone;
 *   o recondicionado fica em Samsung Galaxy A17.
 * - Páginas que só tinham um telemóvel novo vão para o hub da marca.
 *
 * Se o slug voltar a ter ofertas (por exemplo um Galaxy S10 que não seja S10e),
 * o redirect não é aplicado.
 */
export const LEGACY_PRODUCT_REDIRECTS: Record<string, string> = {
  "galaxy-s10-128gb-recondicionado": "/produto/galaxy-s10e-128gb-recondicionado",
  "galaxy-s26-ultra-256gb-recondicionado": "/marca/samsung",
  "ipad-air-11-recondicionado": "/produto/ipad-air-2024-11-recondicionado",
  "ipad-air-2024-1024gb-recondicionado": "/produto/ipad-air-2024-13-1024gb-recondicionado",
  "ipad-air-2024-128gb-recondicionado": "/produto/ipad-air-2024-11-128gb-recondicionado",
  "ipad-air-2024-256gb-recondicionado": "/produto/ipad-air-2024-11-256gb-recondicionado",
  "ipad-air-2024-512gb-recondicionado": "/produto/ipad-air-2024-11-512gb-recondicionado",
  "ipad-air-2025-1024gb-recondicionado": "/produto/ipad-air-2025-13-1024gb-recondicionado",
  "ipad-air-2025-128gb-recondicionado": "/produto/ipad-air-2025-13-128gb-recondicionado",
  "ipad-air-2025-256gb-recondicionado": "/produto/ipad-air-2025-13-256gb-recondicionado",
  "ipad-air-2025-512gb-recondicionado": "/produto/ipad-air-2025-13-512gb-recondicionado",
  "ipad-air-2025-recondicionado": "/produto/ipad-air-2025-13-recondicionado",
  "ipad-air-2026-1024gb-recondicionado": "/produto/ipad-air-2026-13-1024gb-recondicionado",
  "ipad-air-2026-128gb-recondicionado": "/produto/ipad-air-2026-11-128gb-recondicionado",
  "ipad-air-2026-256gb-recondicionado": "/produto/ipad-air-2026-11-256gb-recondicionado",
  "ipad-air-2026-512gb-recondicionado": "/produto/ipad-air-2026-11-512gb-recondicionado",
  "ipad-air-6-128gb-recondicionado": "/produto/ipad-air-2024-11-128gb-recondicionado",
  "ipad-air-6-256gb-recondicionado": "/produto/ipad-air-2024-11-256gb-recondicionado",
  "ipad-air-7-128gb-recondicionado": "/produto/ipad-air-2025-13-128gb-recondicionado",
  "ipad-air-7-256gb-recondicionado": "/produto/ipad-air-2025-11-256gb-recondicionado",
  "ipad-air-8-128gb-recondicionado": "/produto/ipad-air-2026-11-128gb-recondicionado",
  "ipad-pro-2024-1024gb-recondicionado": "/produto/ipad-pro-2024-11-1024gb-recondicionado",
  "ipad-pro-2024-256gb-recondicionado": "/produto/ipad-pro-2024-11-256gb-recondicionado",
  "ipad-pro-2024-512gb-recondicionado": "/produto/ipad-pro-2024-11-512gb-recondicionado",
  "ipad-pro-2024-recondicionado": "/produto/ipad-pro-2024-11-recondicionado",
  "ipad-pro-2025-1024gb-recondicionado": "/produto/ipad-pro-2025-11-1024gb-recondicionado",
  "ipad-pro-2025-256gb-recondicionado": "/produto/ipad-pro-2025-11-256gb-recondicionado",
  "ipad-pro-2025-512gb-recondicionado": "/produto/ipad-pro-2025-11-512gb-recondicionado",
  "ipad-pro-2025-recondicionado": "/produto/ipad-pro-2025-13-recondicionado",
  "iphone-18-pro-max-256gb-recondicionado": "/marca/apple",
  "samsung-a17-128gb-recondicionado": "/produto/samsung-galaxy-a17-128gb-recondicionado",
};

export function legacyProductRedirect(slug: string): string | null {
  return LEGACY_PRODUCT_REDIRECTS[slug] ?? null;
}
