import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "./TopNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bio Gard Formula Calculator",
  description: "Calculator for Bio Gard formulas: batch size, CFU options, costs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-200 font-sans text-zinc-900 antialiased dark:bg-zinc-900 dark:text-zinc-100`}
      >
        <div className="min-h-screen">
          <TopNav />
          {children}
        </div>
      </body>
    </html>
  );
}
