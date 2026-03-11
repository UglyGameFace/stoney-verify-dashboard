"use client"

const labels = {
  home: "Home",
  tickets: "Tickets",
  members: "Members",
  categories: "Categories"
}

export default function MobileBottomNav({ activeTab, onChange, tabs = [] }) {
  return (
    <div className="mobile-bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`sidebar-link ${activeTab === tab ? "active" : ""}`}
          onClick={() => onChange(tab)}
        >
          {labels[tab] || tab}
        </button>
      ))}
    </div>
  )
}
