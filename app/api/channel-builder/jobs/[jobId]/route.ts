import { readBotOperationJob } from "@/lib/bot-api";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return String(value || "").trim();
}

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  let session = null;
  try {
    session = await requireDashboardStaffSession();
    const selectedGuildId = clean(session.selectedGuildId);
    if (!selectedGuildId) {
      return dashboardAuthJson({ ok: false, error: "Select a server before reading Channel Builder jobs.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);
    }

    const jobId = clean(params.jobId);
    if (!jobId) {
      return dashboardAuthJson({ ok: false, error: "jobId required", error_code: "job_id_required" }, 400, session);
    }

    const botResponse = await readBotOperationJob(jobId);
    const job = botResponse.job && typeof botResponse.job === "object" ? botResponse.job as Record<string, unknown> : null;
    const jobGuildId = clean(job?.guild_id);
    if (jobGuildId && jobGuildId !== selectedGuildId) {
      return dashboardAuthJson({ ok: false, error: "That operation belongs to a different selected server.", error_code: "job_server_mismatch" }, 403, session);
    }

    return dashboardAuthJson({ ok: true, selectedGuildId, job }, 200, session);
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}
