"use client";

import RoleHierarchy from "./dashboard/RoleHierarchy";

export default function RoleHierarchyCard({
  roles = [],
  members = [],
  staffUserId = null,
  refreshDashboardData = () => {}
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <RoleHierarchy
        roles={roles}
        members={members}
        currentStaffId={staffUserId}
        onChanged={refreshDashboardData}
      />
    </div>
  );
}
