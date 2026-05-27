import Image from "next/image";
import Link from "next/link";

export const SLOGAN =
  "#descobre em primeira mão a melhor opção em segunda mão.";

type LogoProps = {
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg" | "header";
  className?: string;
  href?: string | null;
};

const SIZE_CLASS = {
  sm: "h-7 sm:h-8",
  md: "h-9 sm:h-10",
  lg: "h-12 sm:h-14",
  header: "h-12 w-auto",
} as const;

export function Logo({
  variant = "full",
  size = "md",
  className = "",
  href = "/",
}: LogoProps) {
  const isFull = variant === "full";
  const isHeader = isFull && size === "header";

  const image = isHeader ? (
    <Image
      src="/logo-goricycle.png"
      alt="goRiCycle"
      width={300}
      height={48}
      priority
      className={`block object-contain ${SIZE_CLASS.header} max-w-[min(300px,60vw)] ${className}`}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={isFull ? "/logo-goricycle.png" : "/logo-icon.png"}
      alt="goRiCycle"
      width={isFull ? 220 : 48}
      height={isFull ? 48 : 48}
      className={`block object-contain ${isFull ? `${SIZE_CLASS[size]} max-w-[min(300px,60vw)]` : "h-8 w-auto sm:h-9"} ${className}`}
      decoding="async"
    />
  );

  if (href === null) {
    return <span className="inline-flex items-center">{image}</span>;
  }

  return (
    <Link href={href} className="inline-flex items-center">
      {image}
    </Link>
  );
}
