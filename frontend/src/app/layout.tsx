import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { SignalRProvider } from "@/hooks/useSignalR";

export const metadata: Metadata = {
  title: "SportScore - Stop app-hopping like a maniac.",
  description: "Real-time scores, stats, news and commentary across football, cricket, rugby and F1.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// ============================================================================
// PLEASE review — remove blanket hydration suppression
// ----------------------------------------------------------------------------
// suppressHydrationWarning on both html and body can hide real client/server
// mismatches from Date.now(), local time formatting, or browser-only state in
// child components. Scope suppression only to the exact text that must differ.
//
// EXAMPLE:
//   <html lang="en">
//     <body>{children}</body>
//   </html>
// ============================================================================
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body suppressHydrationWarning style={{ minHeight: "100vh", display: "flex", flexDirection: "column", width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
        <SignalRProvider>
          <Navbar />
          <main style={{ flex: 1, width: "100%", maxWidth: "100%", overflowX: "hidden", paddingTop: 56 }}>{children}</main>
          <Footer />
        </SignalRProvider>
      </body>
    </html>
  );
}