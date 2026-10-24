import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUXE HAVEN — Guest Services Platform for Moroccan Vacation Rentals",
  description:
    "Curated in-stay extra services for Moroccan riads, villas, and coastal apartments via NFC, QR code, and WhatsApp.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
