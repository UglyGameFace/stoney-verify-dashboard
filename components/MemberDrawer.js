"use client"

export default function MemberDrawer({ member, onClose }) {
  if (!member) return null

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ margin: 0 }}>Member Details</h2>
          <button className="button ghost" onClick={onClose}>Close</button>
        </div>

        <div className="card">
          <div className="row">
            <div className="avatar">
              {member.avatar ? <img src={member.avatar} alt="" width="38" height="38" /> : (member.name || "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 800 }}>{member.name}</div>
              <div className="muted">{member.nickname || "No nickname"} • {member.id}</div>
            </div>
          </div>

          <div className="space" style={{ marginTop: 16 }}>
            <div><strong>Top Role:</strong> {member.top_role || "—"}</div>
            <div><strong>Joined:</strong> {member.joinedAt || "—"}</div>
            <div>
              <strong>Roles:</strong>
              <div className="roles" style={{ marginTop: 8 }}>
                {(member.roles || []).map((role) => <span key={role} className="badge">{role}</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
