import './globals.css';
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import ClientLayout from "./ClientLayout";
import Script from "next/script";

export const metadata: Metadata = {
  title: "My Students Track - Professional School Management System",
  description: "Comprehensive school management system with student tracking, fee management, transport services, and automated reporting. Licensed by Calch Media.",
  keywords: ["school management", "student tracking", "fee management", "transport services", "academic records", "billing system"],
  authors: [{ name: "Calch Media", url: "https://calchmedia.com" }],
  creator: "Calch Media",
  publisher: "Calch Media",
  robots: "noindex, nofollow"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <head>
        {/* jsPDF CDN fallback */}
        <Script src="https://cdn.jsdelivr.net/npm/jspdf@3.0.1/dist/jspdf.umd.min.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  );
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};