import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";
const publicSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production" ? "https://atomarket.vercel.app" : defaultUrl);

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl),
  title: "AtoMarket",
  description: "A nuclear energy prediction market.",
  openGraph: {
    type: "website",
    url: "/",
    title: "AtoMarket",
    description: "A nuclear energy prediction market.",
    siteName: "AtoMarket",
    images: [
      {
        url: "/twitter-image.jpg",
        width: 1200,
        height: 630,
        alt: "AtoMarket",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AtoMarket",
    description: "A nuclear energy prediction market.",
    images: [
      {
        url: "/twitter-image.jpg",
        alt: "AtoMarket",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <footer className="border-t border-slate-800/80 bg-slate-950/80">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-4 text-sm text-slate-400">
              <Link
                href="https://atomic-blender.com"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-emerald-300"
              >
                Created by AtomicBlender LLC ↗
              </Link>
              <span aria-hidden="true" className="text-slate-600">
                &middot;
              </span>
              <span>&copy; {currentYear}</span>
              <span aria-hidden="true" className="text-slate-600">
                &middot;
              </span>
              <Link href="/privacy" className="transition hover:text-emerald-300">
                Privacy
              </Link>
              <span aria-hidden="true" className="text-slate-600">
                &middot;
              </span>
              <Link href="/terms" className="transition hover:text-emerald-300">
                Terms of Use
              </Link>
            </div>
          </footer>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
