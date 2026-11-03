import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "../components/AppShell";

export const metadata: Metadata = {
  title: "What's Good",
  description:
    "Sitting at a restaurant? Get the three dishes to order, backed by real reviews.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
