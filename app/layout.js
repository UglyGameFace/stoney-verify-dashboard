import "@/app/globals.css"
import "@/app/readability.css"
import "@/app/portal-responsive.css"
import "@/app/appearance.css"
import "@/app/appearance-stability.css"
import "@/app/navigation-stability.css"
import "@/app/setup-cleanup.css"
import "@/app/staff-dashboard-focus.css"
import "@/app/auth-state.css"
import AppearanceHydrator from "@/components/dashboard/AppearanceHydrator"
import QuickAppearanceDock from "@/components/dashboard/QuickAppearanceDock"
import GlobalDashboardNav from "@/components/GlobalDashboardNav"
import { env } from "@/lib/env"

export const metadata = {
  title: env.appName,
  description: "Discord moderation and ticketing dashboard"
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppearanceHydrator />
        {children}
        <GlobalDashboardNav />
        <QuickAppearanceDock />
      </body>
    </html>
  )
}
