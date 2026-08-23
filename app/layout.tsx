import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face, used in italic everywhere — headings should read as written,
// not set.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: "italic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Two Years",
  description: "A scroll through our first two years.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Opening pastel; ThemeShift repaints the page per month from lib/palette.
  themeColor: "#e9d9c9",
  // The runner scene is full-bleed; let it reach behind the notch/home bar.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
