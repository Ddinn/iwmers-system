import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import RealtimeAlertListener from "@/components/RealtimeAlertListener"; // 👈 Import the listener

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EcoGuard | IWMERS",
  description: "Integrated Weather Monitoring and Emergency Response System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Navbar />
        
        {/* 👇 Drop the silent listener here 👇 */}
        <RealtimeAlertListener />
        
        {children}
      </body>
    </html>
  );
}