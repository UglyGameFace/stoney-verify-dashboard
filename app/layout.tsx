import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stoney Verify — Staff Dashboard",
  description: "Staff dashboard for Stoney Verify (tokens, kick timers, approvals, audit logs, realtime monitor).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

