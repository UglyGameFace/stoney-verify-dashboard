import { getDashboardAuthSession, dashboardAuthJson } from "@/lib/dashboard-auth"

export async function GET() {
  try {
    const session = await getDashboardAuthSession()
    return dashboardAuthJson({ session }, 200, session)
  } catch (error) {
    return dashboardAuthJson({ session: null, error: error?.message || "Failed to load session." }, 200, null)
  }
}
