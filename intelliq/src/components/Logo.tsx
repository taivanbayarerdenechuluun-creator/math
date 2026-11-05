import Link from "next/link";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#925CFF" />
          <stop offset="0.6" stopColor="#527BFF" />
          <stop offset="1" stopColor="#39DDF2" />
        </linearGradient>
      </defs>
      <polygon points="20,3 35,12 35,28 20,37 5,28 5,12" fill="none" stroke="url(#lg)" strokeWidth="2.4" />
      <circle cx="20" cy="20" r="4.2" fill="url(#lg)" />
      <path d="M20 20 L20 8 M20 20 L31 26 M20 20 L9 26" stroke="url(#lg)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="INTELLIQ home">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight">
        INTELL<span className="grad-text">IQ</span>
      </span>
    </Link>
  );
}
