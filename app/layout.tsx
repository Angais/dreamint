import type { Metadata } from "next";
import "./globals.css";
import { AccessGuard } from "./_components/access-guard";

export const metadata: Metadata = {
  title: "Dreamint",
  description: "Craft image generations with Dreamint.",
  icons: {
    icon: "/Dreaming.png",
  },
  viewport: "width=device-width, initial-scale=1, interactive-widget=resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const accessProtectionEnabled = Boolean(process.env.ACCESS_PASSWORD?.trim());

  return (
    <html lang="en">
      <body className="antialiased">
        <AccessGuard protectionEnabled={accessProtectionEnabled}>{children}</AccessGuard>
      </body>
    </html>
  );
}

