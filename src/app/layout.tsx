import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adaptive Interview Engine",
  description: "AI-powered adaptive technical interviews",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto max-w-5xl flex items-center justify-between">
            <Link href="/dashboard" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 hover:opacity-80">
              Adaptive Interview Engine
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                Dashboard
              </Link>
              <Link href="/setup" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                New Interview
              </Link>
              <Link href="/positions" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                Positions
              </Link>
              <Link href="/candidates" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                Candidates
              </Link>
              <Link href="/campaigns" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                Campaigns
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
