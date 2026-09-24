import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RoleProvider } from "@/components/RoleContext";
import { PractitionerProvider } from "@/components/PractitionerContext";
import { ThemeBootstrap } from "@/components/settings/ThemeSettings";
import { getPractitioner } from "@/lib/data";

export const metadata: Metadata = {
  title: "Heartful OS",
  description: "Client journey management for psychedelic harm reduction and integration practitioners.",
  manifest: "/manifest.webmanifest",
  // Lets clients "Add to Home Screen" on iOS with the real logo (via
  // apple-icon.tsx) and open as a standalone app rather than a browser tab.
  // apple-mobile-web-app-title also keeps the home-screen label as
  // "Heartful OS" regardless of which page happened to be open when they
  // added it (inner pages set their own dynamic <title>).
  appleWebApp: {
    capable: true,
    title: "Heartful OS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#F3774D",
};

const themeBootstrapScript = `(() => {
  const root = document.documentElement;
  let theme = "golden-canopy";
  try {
    const saved = window.localStorage.getItem("heartful-theme");
    if (saved === "golden-canopy" || saved === "mushroom-grove" || saved === "original" || saved === "dark") {
      theme = saved;
    } else if (saved === "light") {
      window.localStorage.setItem("heartful-theme", "golden-canopy");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "dark";
    }
  } catch {}
  root.dataset.theme = theme;
  root.dataset.themeReady = "true";
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const practitioner = await getPractitioner();

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <PractitionerProvider initialName={practitioner.full_name} initialPracticeName={practitioner.practice_name}>
          <RoleProvider>
            <ThemeBootstrap />
            {children}
          </RoleProvider>
        </PractitionerProvider>
      </body>
    </html>
  );
}
