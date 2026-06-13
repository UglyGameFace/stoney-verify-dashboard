import Link from "next/link";
import { cookies } from "next/headers";
import ServerSelector from "@/components/dashboard/ServerSelector";
import AuthStatePage from "@/components/dashboard/AuthStatePage";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCESS_COOKIE = "discord_access_token";
const REFRESH_COOKIE = "discord_refresh_token";
const SERVER_CACHE_COOKIE = "dank_manageable_servers_cache";

function hasDashboardEntryProof(): boolean {
  const store = cookies();
  return Boolean(
    store.get(ACCESS_COOKIE)?.value ||
    store.get(REFRESH_COOKIE)?.value ||
    store.get(SERVER_CACHE_COOKIE)?.value
  );
}

export default async function ServersPage() {
  const signedInOrRecentlyVerified = hasDashboardEntryProof();

  if (!signedInOrRecentlyVerified) {
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
      actions={<Link href="/" className="button ghost">Back to Home</Link>}
    >
      <ServerSelector />
    </SetupWorkspaceShell>
  );
}
