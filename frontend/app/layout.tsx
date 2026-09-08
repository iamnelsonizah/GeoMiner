import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#141B26",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "GeoMiner — Mineral Exploration Targeting System",
  description: "Cloud-Based Remote Sensing Mineral Prospectivity, Spectral Alteration, and Structural Lineament Target Generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="h-[100dvh] w-full bg-[#0A0D12] text-[#B7BFCB] overflow-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
