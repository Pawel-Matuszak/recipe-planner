import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Obiadki",
    short_name: "Obiadki",
    description: "Przepisy, spiżarnia, plan tygodnia i lista zakupów.",
    lang: "pl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F2F4EF",
    theme_color: "#2E7048",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
