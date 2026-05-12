import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import NavBar from "@/components/layout/NavBar";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wanderlog",
  description: "Collaborative trip memory and planning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
