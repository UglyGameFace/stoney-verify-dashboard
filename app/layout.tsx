import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stoney Verify — Staff Dashboard",
  description:
    "Stoney Baloney staff dashboard for Stoney Verify (tokens, kick timers, approvals, audit logs, realtime monitor).",
  themeColor: "#0b0f14",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Make browsers render dark UI controls / address bar */}
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#0b0f14" />
      </head>
      <body className="sb-body">{children}</body>
    </html>
  );
}
