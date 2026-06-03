import Link from "next/link";
import ServerSelector from "@/components/dashboard/ServerSelector";
import AuthStatePage from "@/components/dashboard/AuthStatePage";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";
import { getSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ServersPage() {
  const session = await getSession();

  if (!session) {
    return (
      <AuthStatePage
        variant="login"
        message="Sign in with Discord to choose which server you want to manage. The dashboard will not open Discord authorization until you press the sign-in button."
        showReset={false}
        showBack={false}
      />
    );
  }

  return (
    <SetupWorkspaceShell
      activeStep="servers"
      eyebrow="Step 1 of 3"
      title="Choose your server"
      description="Pick the Discord server you can manage. Dank Shield will load tickets, forms, categories, and settings for that server only."
      actions={
        <>
          <Link href="/" className="button primary">Dashboard</Link>
          <Link href="/auth-status" className="button ghost">Auth Status</Link>
        </>
      }
    >
      <ServerSelector />
    </SetupWorkspaceShell>
  );
}
