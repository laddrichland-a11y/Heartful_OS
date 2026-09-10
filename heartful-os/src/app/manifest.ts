import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Heartful OS",
    short_name: "Heartful OS",
    description: "Client journey management for psychedelic harm reduction and integration practitioners.",
    // "/" redirects to /dashboard, which is practitioner-only — so a client
    // who added the portal to their home screen used to launch straight into
    // the practitioner gate. It also can't carry the per-client query the
    // portal needs. /portal is the right entry point for both roles;
    // middleware rebuilds ?client=<id> from a cookie for real clients, and
    // practitioners get the in-app picker as before.
    start_url: "/portal",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#b5663f",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
