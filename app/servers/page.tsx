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
        message="Sign in with Discord to choose which server you want to manage. After login, you will come right back here instead of being dropped on Home."
        showReset={false}
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
