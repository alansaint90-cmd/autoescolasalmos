import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auto Pro IA Salmos",
  description: "Atendimento WhatsApp com IA e handoff humano para autoescolas.",
  applicationName: "Auto Pro IA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Auto Pro IA"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }]
  },
  openGraph: {
    title: "Auto Pro IA",
    description: "CRM inteligente com IA para autoescolas.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Auto Pro IA" }]
  },
  twitter: {
    card: "summary",
    title: "Auto Pro IA",
    description: "CRM inteligente com IA para autoescolas.",
    images: ["/icons/icon-512.png"]
  }
};

export const viewport: Viewport = {
  themeColor: "#0b1120",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = window.localStorage.getItem("auto-pro-ia:theme") || "dark";
                document.documentElement.dataset.theme = theme;
                document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
              } catch (_) {}
            `
          }}
        />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
