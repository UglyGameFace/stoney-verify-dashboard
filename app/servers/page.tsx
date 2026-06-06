import Link from "next/link";
import ServerSelector from "@/components/dashboard/ServerSelector";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ServersPage() {
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
