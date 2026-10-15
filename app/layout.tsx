import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ReviewQR — Google Review QR Code & NFC Link Generator",
  description:
    "Generate a ready-to-print QR code and NFC link for any Google Business Profile. Free, instant, no sign-up. QR codes link directly to Google — no redirects, no expiration.",
  keywords: [
    "Google Review QR Code",
    "NFC Google Review",
    "Google Business QR",
    "Review QR Generator",
    "Google Maps QR Code",
    "NFC card review link",
  ],
  openGraph: {
    title: "ReviewQR — Google Review QR Code & NFC Link Generator",
    description:
      "Generate a ready-to-print QR code and NFC link for any Google Business Profile.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
