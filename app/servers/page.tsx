import Link from "next/link";
import ServerSelector from "@/components/dashboard/ServerSelector";
import AuthStatePage from "@/components/dashboard/AuthStatePage";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";
import { getDashboardAuthSession } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function hasUsableDashboardSession(): Promise<boolean> {
  try {
    return Boolean(await getDashboardAuthSession());
  } catch {
    return false;
  }
}

export default async function ServersPage() {
  const signedIn = await hasUsableDashboardSession();

  if (!signedIn) {
    return (
      <AuthStatePage
        variant="login"
        message="Sign in with Discord to choose which server you want to manage. After login, you will come right back here instead of seeing an empty server list."
        showReset={true}
        showBack={false}
        returnTo="/servers"
      />
    );
  }

  return (
    <SetupWorkspaceShell
      activeStep="servers"
      eyebrow="Step 1 of 3"
      title="Choose your server"
      description="This page only handles server selection and bot installation. After one server is selected, Home becomes the live dashboard for that server."
      actions={
        <Link href="/" className="button ghost">Back to Home</Link>
      }
    >
      <ServerSelector />
    </SetupWorkspaceShell>
  );
}
