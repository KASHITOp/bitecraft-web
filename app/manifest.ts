import type { MetadataRoute } from "next";

// Needed for the static export used by the Android app.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "BiteCraft",
    short_name: "BiteCraft",
    description: "What can I actually cook right now, in this room, with what I have and what I can afford?",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef0ec",
    theme_color: "#eef0ec",
    categories: ["food", "lifestyle", "health"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pantry", url: "/pantry" },
      { name: "Fridge Raid Chef", url: "/chef" },
      { name: "Today's plan", url: "/planner" },
    ],
  };
}
