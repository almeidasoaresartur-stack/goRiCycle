"use client";

import Image from "next/image";
import { useState } from "react";

type ProductCardImageProps = {
  src: string;
  fallbackSrc?: string | null;
  alt: string;
};

export function ProductCardImage({ src, fallbackSrc, alt }: ProductCardImageProps) {
  const [useFallback, setUseFallback] = useState(false);
  const currentSrc = useFallback && fallbackSrc ? fallbackSrc : src;
  const isExternal = /^https?:\/\//i.test(currentSrc);

  if (isExternal) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={currentSrc}
        alt={alt}
        className="h-44 w-full object-contain p-4"
        loading="lazy"
      />
    );
  }

  return (
    <div className="relative h-44 w-full overflow-hidden bg-white">
      <Image
        src={currentSrc}
        alt={alt}
        fill
        className="object-contain p-4"
        sizes="(max-width: 768px) 50vw, 33vw"
        onError={() => {
          if (fallbackSrc && !useFallback) {
            setUseFallback(true);
          }
        }}
      />
    </div>
  );
}
