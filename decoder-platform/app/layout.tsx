import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Apple devices render SF Pro via the system stack; Inter is the closest
// stand-in everywhere else (Windows client laptops, meeting-room PCs).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Country Decoders",
  description: "Country decoder dashboards",
};

export const viewport: Viewport = {
  themeColor: "#eef1f6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
