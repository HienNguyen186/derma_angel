import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DermaAngel | Dán đúng Mood, Diện đúng Mốt",
  description: "Khám phá 5 thiết kế Acne Beauty Patch của DermaAngel. Chọn mood của bạn và mua sắm theo cách mình yêu thích.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
