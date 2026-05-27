"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

import { StoreLogo } from "@/components/StoreLogo";
import {
  formatBannerPrice,
  getFeaturedBannerSlides,
  type FeaturedBannerSlide,
} from "@/lib/featured-banner";

const AUTOPLAY_MS = 5000;
const SLIDES = getFeaturedBannerSlides();

type FeaturedCarouselProps = {
  slides?: FeaturedBannerSlide[];
};

export function FeaturedCarousel({ slides = SLIDES }: FeaturedCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback((index: number) => {
    if (slides.length === 0) return;
    setActiveIndex(((index % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  const goNext = useCallback(() => {
    goTo(activeIndex + 1);
  }, [activeIndex, goTo]);

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;

    const timer = window.setInterval(goNext, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [activeIndex, goNext, isPaused, slides.length]);

  if (slides.length === 0) return null;

  return (
    <section
      className="bg-[#F8FAFC] px-4 pb-2 pt-4 sm:px-6 sm:pb-3 lg:px-8"
      aria-label="Destaques premium das lojas parceiras"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative mx-auto max-w-7xl">
        <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:min-h-[300px]">
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;

            return (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                  isActive ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                }`}
                aria-hidden={!isActive}
              >
                <div
                  className={`flex h-full min-h-[320px] flex-col md:min-h-[300px] md:flex-row ${slide.backgroundClass}`}
                >
                  <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-8 md:py-10 md:pl-10">
                    <div className="mb-4">
                      <StoreLogo
                        storeSlug={slide.store}
                        storeLabel={slide.storeLabel}
                        className="max-w-[140px]"
                        height={36}
                      />
                    </div>

                    <p className={`text-sm font-semibold uppercase tracking-wider ${slide.accentClass}`}>
                      {slide.headline}
                    </p>

                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {slide.model}
                    </h2>

                    <p className="mt-2 text-sm text-slate-600 sm:text-base">{slide.subtitle}</p>

                    <div className="mt-5 flex flex-wrap items-end gap-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Preço imbatível
                        </p>
                        <p className="text-3xl font-bold tracking-tight text-slate-900">
                          {formatBannerPrice(slide.price)}
                        </p>
                      </div>

                      <a
                        href={slide.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition ${slide.buttonClass}`}
                      >
                        Ver Oferta
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  <div className="relative flex flex-1 items-center justify-center px-6 pb-8 md:px-8 md:pb-0 md:pr-10">
                    <div className="relative h-52 w-full max-w-sm sm:h-60 md:h-64">
                      <Image
                        src={slide.imageUrl}
                        alt={slide.model}
                        fill
                        className="object-contain object-center drop-shadow-md"
                        sizes="(max-width: 768px) 80vw, 400px"
                        priority={index === 0}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(index)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  index === activeIndex
                    ? "w-7 bg-slate-800"
                    : "w-2.5 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Ver destaque ${slide.storeLabel}`}
                aria-current={index === activeIndex ? "true" : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
