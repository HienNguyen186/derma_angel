import type { Metadata } from "next";
import "./globals.css";
import "./storefront-upgrade.css";

export const metadata: Metadata = {
  title: "DermaAngel Acne Beauty Patch | Dán đúng Mood, Diện đúng Mốt | Form V",
  description: "Khám phá 5 thiết kế DermaAngel Acne Beauty Patch cùng Form V tại B2S 2026. Chọn mood yêu thích, xem sản phẩm và gửi yêu cầu đặt hàng.",
  openGraph: { title: "DermaAngel — Mood in the Clouds", description: "Dán đúng Mood, Diện đúng Mốt", images: ["/products-hero.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preload" href="/fonts/lora-normal-400-700-vietnamese.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/lora-normal-400-700-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
