import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SiteBanners, StatusProvider } from "@/components/SiteChrome";
import { SkipLink, TitleSync } from "@/components/PageChrome";
import { Atmosphere } from "@/components/Atmosphere";
import { Interactions } from "@/components/Interactions";

const inter = Inter({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "INTELLIQ — Discover the Power of Your Mind", template: "%s · INTELLIQ" },
  description:
    "Adaptive cognitive assessments across seven domains with honest, data-driven feedback. A practice tool, not a clinical IQ test.",
  openGraph: {
    title: "INTELLIQ — Discover the Power of Your Mind",
    description: "Adaptive cognitive assessments with honest, data-driven feedback.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#080b18",
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint so there is no theme flash.
const themeScript = `try{var t=localStorage.getItem('iq-theme');if(!t){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${grotesk.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Atmosphere />
        <Providers>
          <SkipLink />
          <TitleSync />
          <Interactions />
          <StatusProvider>
            {children}
            <SiteBanners />
          </StatusProvider>
        </Providers>
      </body>
    </html>
  );
}
