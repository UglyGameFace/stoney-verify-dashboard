import { GET as getStaffDashboard } from "@/app/api/staff/dashboard/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Compatibility route for older dashboard refresh calls.
// The real staff dashboard API is now selected-server scoped, so this route
// delegates there instead of using the legacy default env guild.
export async function GET(request) {
  return getStaffDashboard(request);
}
