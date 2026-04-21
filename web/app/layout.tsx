import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Space_Grotesk } from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400"
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"]
});

const meta = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-meta",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "Infrastructure as Words",
  description: "Describe infrastructure, shape a build brief, and revisit saved requests."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${meta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
