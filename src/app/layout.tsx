import type { Metadata } from "next";
import { Space_Grotesk, Public_Sans, JetBrains_Mono } from "next/font/google";
import { AmbientBg } from "@/components/ambient-bg";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "HireTrack — lightweight applicant tracking",
    template: "%s · HireTrack",
  },
  description:
    "Applicant tracking for small hiring teams: pipeline management, interview scorecards, and hiring analytics without the enterprise bloat.",
  openGraph: {
    title: "HireTrack — lightweight applicant tracking",
    description:
      "Post jobs, move candidates through a visual pipeline, run structured interview scorecards, and see where every req is stuck.",
    url: APP_URL,
    siteName: "HireTrack",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "HireTrack — lightweight applicant tracking",
    description:
      "Pipeline management, interview scorecards, and hiring analytics for small teams.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${publicSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AmbientBg />
        {children}
      </body>
    </html>
  );
}
