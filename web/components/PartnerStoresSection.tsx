import Image from "next/image";

const PARTNER_STORES = [
  {
    name: "iServices",
    href: "https://www.iservices.pt",
    logoSrc: "/stores/iservices.png",
    logoWidth: 128,
    logoHeight: 44,
  },
  {
    name: "Refurbed",
    href: "https://www.refurbed.pt",
    logoSrc: "/stores/refurbed.svg",
    logoWidth: 120,
    logoHeight: 35,
  },
  {
    name: "Swappie",
    href: "https://swappie.com/pt/",
    logoSrc: "/stores/swappie.png",
    logoWidth: 120,
    logoHeight: 48,
  },
  {
    name: "Certideal",
    href: "https://www.certideal.pt",
    logoSrc: "/stores/certideal.svg",
    logoWidth: 140,
    logoHeight: 24,
  },
  {
    name: "Callphone",
    href: "https://callphone.pt",
    logoSrc: "/stores/callphone.png",
    logoWidth: 140,
    logoHeight: 28,
  },
] as const;

export function PartnerStoresSection() {
  return (
    <section className="w-full px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
          Lojas Parceiras
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {PARTNER_STORES.map((store) => (
            <a
              key={store.name}
              href={store.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visitar ${store.name}`}
              className="group flex min-h-[7.5rem] flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-200 hover:border-gray-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              <div className="flex h-14 w-full items-center justify-center">
                <Image
                  src={store.logoSrc}
                  alt={`Logótipo ${store.name}`}
                  width={store.logoWidth}
                  height={store.logoHeight}
                  className="max-h-12 w-auto max-w-[85%] object-contain object-center transition-transform duration-200 group-hover:scale-[1.02]"
                />
              </div>
              <span className="mt-3 text-[11px] text-gray-400 transition-colors group-hover:text-gray-600">
                Ver loja →
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
