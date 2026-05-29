const PARTNER_STORES = [
  {
    name: "iServices",
    href: "https://www.iservices.pt",
    logoSrc: "/stores/iservices.svg",
  },
  {
    name: "Refurbed",
    href: "https://www.refurbed.pt",
    logoSrc: "/stores/refurbed.svg",
  },
  {
    name: "Swappie",
    href: "https://swappie.com/pt/",
    logoSrc: "/stores/swappie.svg",
  },
  {
    name: "Certideal",
    href: "https://www.certideal.pt",
    logoSrc: "/stores/certideal.svg",
  },
] as const;

export function PartnerStoresSection() {
  return (
    <section className="w-full px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
          Lojas Parceiras
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {PARTNER_STORES.map((store) => (
            <a
              key={store.name}
              href={store.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white p-6 transition-all duration-200 hover:border-gray-200 hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={store.logoSrc}
                alt={store.name}
                className="h-8 w-auto object-contain"
              />
              <span className="text-xs text-gray-400 transition-colors group-hover:text-gray-600">
                Ver loja →
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
