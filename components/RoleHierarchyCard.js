export default function RoleHierarchyCard({ roles = [] }) {
  return (
    <div className="card" id="roles">
      <h2 style={{ marginTop: 0 }}>Role Hierarchy Viewer</h2>
      <div className="space">
        {!roles.length ? <div className="empty-state">No roles synced yet.</div> : null}
        {roles.map((role, index) => (
          <div key={role.id || role.role_id} className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800 }}>{index + 1}. {role.name}</div>
              <div className="muted">Position {role.position}</div>
            </div>
            <span className="badge">{role.member_count || 0} members</span>
          </div>
        ))}
      </div>
    </div>
  )
}
