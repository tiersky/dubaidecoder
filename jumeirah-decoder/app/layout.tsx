import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Country Decoder — Dubai Tourism Agency",
  description: "Strategic Travel Intelligence Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} font-sans antialiased`}>
        {/* Gradient background with decorative blobs */}
        <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50/80 to-indigo-100/70">
          <div className="absolute -top-40 -right-40 h-[700px] w-[700px] rounded-full bg-blue-200/25 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-200/20 blur-3xl" />
          <div className="absolute top-1/3 left-1/4 h-[500px] w-[500px] rounded-full bg-emerald-100/15 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] rounded-full bg-amber-100/10 blur-3xl" />
        </div>
        {children}
      </body>
    </html>
  );
}
