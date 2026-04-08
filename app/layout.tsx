import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import "../styles/description.css";
import NextTopLoader from "nextjs-toploader";
import { MultipleAddProvider } from "@/contexts/MultipleAddContext";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ATS system",
  description: "Complete Staffing solutions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans antialiased`}>
        <NextTopLoader
          color="#2563eb"
          initialPosition={0.2}
          crawlSpeed={200}
          height={3}
          crawl
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #2563eb,0 0 5px #2563eb"
        />
        <MultipleAddProvider>
          {children}
        </MultipleAddProvider>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
