import type { Metadata } from "next";
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
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
