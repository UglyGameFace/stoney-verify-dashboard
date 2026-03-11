"use client"

const labels = {
  home: "Lounge",
  tickets: "Tickets",
  members: "Members",
  categories: "Flows"
}

const icons = {
  home: "🌿",
  tickets: "🎟️",
  members: "👥",
  categories: "🧩"
}

export default function MobileBottomNav({ activeTab, onChange, tabs = [] }) {
  return (
    <div className="mobile-bottom-nav">
      {tabs.map((tab) => {
        const active = activeTab === tab

        return (
          <button
            key={tab}
            type="button"
            className={`sidebar-link ${active ? "active" : ""}`}
            onClick={() => onChange(tab)}
            aria-pressed={active}
          >
            <span
              style={{
                display: "block",
                fontSize: 15,
                lineHeight: 1,
                marginBottom: 4
              }}
            >
              {icons[tab] || "•"}
            </span>

            <span
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700
              }}
            >
              {labels[tab] || tab}
            </span>
          </button>
        )
      })}
    </div>
  )
}
