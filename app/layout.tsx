import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AccessGuard } from "./_components/access-guard";

export const metadata: Metadata = {
  title: "Dreamint (GPT)",
  description: "Craft image generations with Dreamint (GPT).",
  icons: {
    icon: "/Dreaming.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
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
