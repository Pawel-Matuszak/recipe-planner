import "../index.css";
import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Obiadki",
  description: "Przepisy, spiżarnia, plan tygodnia i lista zakupów.",
  applicationName: "Obiadki",
  appleWebApp: { capable: true, title: "Obiadki", statusBarStyle: "default" },
  icons: { icon: "/icons/favicon.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F4EF" },
    { media: "(prefers-color-scheme: dark)", color: "#121814" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"}>{children}</SerwistProvider>
      </body>
    </html>
  );
}
