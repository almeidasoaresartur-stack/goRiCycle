import Link from "next/link";

export const SLOGAN =
  "#descobre em primeira mão a melhor opção em segunda mão.";

type LogoProps = {
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg" | "header";
  theme?: "light" | "dark";
  className?: string;
  href?: string | null;
};

const LOGO_SRC = "/images/goricycle-logo.png";
const LOGO_WIDTH = 1024;
const LOGO_HEIGHT = 171;

const SIZE_CLASS = {
  sm: "h-7 sm:h-8",
  md: "h-9 sm:h-10",
  lg: "h-11 sm:h-12",
  header: "h-14 w-auto md:h-16",
} as const;

const DARK_THEME_CLASS = "brightness-0 invert";

export function Logo({
  variant = "full",
  size = "md",
  theme = "light",
  className = "",
  href = "/",
}: LogoProps) {
  const isFull = variant === "full";
  const isHeader = isFull && size === "header";
  const isDark = theme === "dark";
  const themeClass = isDark ? DARK_THEME_CLASS : "";

  const image = isHeader ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="goRiCycle"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      className={`block object-contain object-left ${SIZE_CLASS.header} ${className}`}
      decoding="async"
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={isFull ? LOGO_SRC : "/logo-icon.png"}
      alt="goRiCycle"
      width={isFull ? LOGO_WIDTH : 256}
      height={isFull ? LOGO_HEIGHT : 256}
      className={`block object-contain ${isFull ? `${SIZE_CLASS[size]} max-w-[min(280px,70vw)]` : "h-8 w-auto sm:h-9"} ${themeClass} ${className}`}
      decoding="async"
    />
  );

  if (href === null) {
    return <span className="inline-flex items-center">{image}</span>;
  }

  return (
    <Link href={href} className="inline-flex shrink-0 items-center bg-transparent">
      {image}
    </Link>
  );
}
