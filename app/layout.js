import "@/app/globals.css"
import { env } from "@/lib/env"

export const metadata = {
  title: env.appName,
  description: "Discord moderation and ticketing dashboard"
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
