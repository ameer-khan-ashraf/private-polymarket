import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private Polymarket",
  description: "Private prediction markets for friends",
};

import { Providers } from "../components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
