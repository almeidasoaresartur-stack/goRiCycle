import Image from "next/image";

const LOGO_WIDTH = 160;
const LOGO_HEIGHT = 44;

const PARTNER_STORES = [
  {
    name: "iServices",
    slug: "iservices",
    href: "https://www.iservices.pt",
  },
  {
    name: "Refurbed",
    slug: "refurbed",
    href: "https://www.refurbed.pt",
  },
  {
    name: "Swappie",
    slug: "swappie",
    href: "https://swappie.com/pt/",
  },
  {
    name: "Certideal",
    slug: "certideal",
    href: "https://www.certideal.pt",
  },
  {
    name: "Callphone",
    slug: "callphone",
    href: "https://callphone.pt",
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
              key={store.slug}
              href={store.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visitar ${store.name}`}
              className="group flex min-h-[7.5rem] flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-200 hover:border-gray-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              <div className="flex h-11 w-full items-center justify-center">
                <Image
                  src={`/stores/${store.slug}.svg`}
                  alt={`Logótipo ${store.name}`}
                  width={LOGO_WIDTH}
                  height={LOGO_HEIGHT}
                  className="h-11 w-auto max-w-[90%] object-contain object-center transition-transform duration-200 group-hover:scale-[1.02]"
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
