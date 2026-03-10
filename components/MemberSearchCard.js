"use client"

import { useState } from "react"
import { initials } from "@/lib/format"
import MemberDrawer from "@/components/MemberDrawer"

export default function MemberSearchCard() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(null)

  async function search(e) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/discord/member-search?q=${encodeURIComponent(query)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Search failed.")
      setResults(json.results || [])
    } catch (err) {
      setError(err.message || "Search failed.")
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" id="members">
      <h2 style={{ marginTop: 0 }}>Live Discord Member Search</h2>
      <form className="space" onSubmit={search}>
        <input className="input" placeholder="Search username or nickname" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="button primary" type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
      </form>

      {error ? <div className="error-banner" style={{ marginTop: 12 }}>{error}</div> : null}

      <div className="space" style={{ marginTop: 14 }}>
        {!loading && results.length === 0 ? <div className="empty-state">No member results yet.</div> : null}
        {results.map((member) => (
          <button key={member.id} className="card tight" style={{ textAlign: "left" }} onClick={() => setSelected(member)}>
            <div className="row">
              <div className="avatar">
                {member.avatar ? <img src={member.avatar} alt="" width="38" height="38" /> : initials(member.name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{member.name}</div>
                <div className="muted">{member.nickname || "No nickname"} • {member.top_role || "No top role"}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <MemberDrawer member={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
