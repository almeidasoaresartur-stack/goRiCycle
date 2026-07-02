import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "assets.swappie.com",
  "cdn.shopify.com",
  "cf4.certideal.com",
  "cf5.certideal.com",
  "cf6.certideal.com",
  "files.refurbed.com",
  "loja.iservices.pt",
  "r.iservices.pt",
]);

const FALLBACK_IMAGE = "https://goricycle.com/images/goricycle-logo.png";

function fallback() {
  return NextResponse.redirect(FALLBACK_IMAGE, { status: 302 });
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) return fallback();

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return fallback();
  }

  // Segurança: só fazemos proxy a domínios conhecidos das lojas parceiras
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return fallback();

  // Cloudflare Image Resizing (Swappie): força JPEG em vez de format=auto,
  // que pode devolver AVIF/WebP — formatos que o Facebook/Instagram rejeitam.
  let fetchUrl = parsed.toString();
  if (fetchUrl.includes("/cdn-cgi/image/") && fetchUrl.includes("format=auto")) {
    fetchUrl = fetchUrl.replace("format=auto", "format=jpg");
  }

  try {
    const upstream = await fetch(fetchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.startsWith("image/") || contentType.includes("svg")) {
      return fallback();
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return fallback();
  }
}
