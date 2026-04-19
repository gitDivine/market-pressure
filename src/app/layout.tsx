import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import FeedbackWidget from "@/components/FeedbackWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Markets Assist — Buy vs Sell Pressure Dashboard",
  icons: { icon: "/logo.svg" },
  description:
    "Real-time buying vs selling pressure analysis across crypto, forex, and stocks with multi-timeframe confluence detection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        {process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" && (
          <div className="pointer-events-none fixed bottom-4 right-4 z-[999] rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-mono text-white/40 backdrop-blur-sm sm:bottom-6 sm:left-6 sm:right-auto">
            dev mode
          </div>
        )}
        <Analytics />
        <FeedbackWidget />
      </body>
    </html>
  );
}
