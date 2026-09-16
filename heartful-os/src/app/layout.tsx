import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RoleProvider } from "@/components/RoleContext";
import { ThemeBootstrap } from "@/components/settings/ThemeSettings";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <RoleProvider>
          <ThemeBootstrap />
          {children}
        </RoleProvider>
      </body>
    </html>
  );
}
