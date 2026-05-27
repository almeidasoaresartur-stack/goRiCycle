import { getStoreInfo } from "@/lib/stores";
import type { ProductSource } from "@/lib/types";

type StoreLogoProps = {
  storeSlug: ProductSource | string | null | undefined;
  storeLabel?: string | null;
  className?: string;
  height?: number;
};

export function StoreLogo({
  storeSlug,
  storeLabel,
  className = "",
  height = 42,
}: StoreLogoProps) {
  const info = getStoreInfo(storeSlug);
  const label = storeLabel ?? info?.label ?? "Loja";
  const imgHeight = height;

  if (info?.logoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={info.logoSrc}
        alt={label}
        height={imgHeight}
        className={`h-10 w-auto object-contain sm:h-11 ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={`inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ${className}`}
    >
      {label}
    </span>
  );
}
