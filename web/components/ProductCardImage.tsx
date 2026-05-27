"use client";

import Image from "next/image";
import { useState } from "react";

type ProductCardImageProps = {
  src: string;
  /** Fallback local (/images/products/...) se a imagem principal falhar */
  fallbackSrc?: string | null;
  alt: string;
};

export function ProductCardImage({ src, fallbackSrc, alt }: ProductCardImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);

  return (
    <div className="relative h-44 w-full overflow-hidden bg-white">
      <Image
        src={currentSrc}
        alt={alt}
        fill
        className="object-contain p-4"
        sizes="(max-width: 768px) 50vw, 33vw"
        onError={() => {
          if (fallbackSrc && currentSrc !== fallbackSrc) {
            setCurrentSrc(fallbackSrc);
          }
        }}
      />
    </div>
  );
}
