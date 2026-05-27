"use client";

import { useState } from "react";

type ProductCardImageProps = {
  src: string;
  fallbackSrc?: string | null;
  alt: string;
};

export function ProductCardImage({ src, fallbackSrc, alt }: ProductCardImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      className="h-48 w-full object-contain p-4"
      loading="lazy"
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}
