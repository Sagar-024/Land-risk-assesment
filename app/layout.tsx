import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Land Purchase Risk Assessment",
  description: "Evaluate red flags before buying land",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}