"use client"

import { useEffect, useMemo, useState } from "react"
import MemberDrawer from "@/components/MemberDrawer"

function initials(value) {
  const raw = String(value || "?").trim()
  return raw ? raw.slice(0, 1).toUpperCase() : "?"
}

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}

export default function MemberSearchCard() {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 250)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      const q = debouncedQuery.trim()

      if (!q) {
        setResults([])
        setError("")
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const res = await fetch(`/api/discord/member-search?q=${encodeURIComponent(q)}`, {
          cache: "no-store"
        })
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error || "Member search failed.")
        }

        if (!cancelled) {
          setResults(Array.isArray(json.results) ? json.results : [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Member search failed.")
          setResults([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  const summary = useMemo(() => {
    const total = results.length
    const inServer = results.filter((x) => x.in_guild !== false).length
    const leftServer = results.filter((x) => x.in_guild === false).length
    return { total, inServer, leftServer }
  }, [results])

  return (
    <>
      <div className="card">
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Live Member Search</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              Search username, display name, nickname, or ID as you type
            </div>
          </div>

          {query.trim() ? (
            <div className="muted" style={{ fontSize: 13 }}>
              {summary.total} result{summary.total === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>

        <div className="space">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            autoComplete="off"
          />

          {error ? <div className="error-banner">{error}</div> : null}

          {!query.trim() ? (
            <div className="empty-state">
              Start typing to search live member records.
            </div>
          ) : null}

          {loading ? (
            <div className="loading-state">Searching members...</div>
          ) : null}

          {query.trim() && !loading && !results.length && !error ? (
            <div className="empty-state">No matching members found.</div>
          ) : null}

          {!loading && results.length ? (
            <>
              <div className="member-search-summary">
                <span className="badge">{summary.total} tracked</span>
                <span className="badge claimed">{summary.inServer} in server</span>
                {summary.leftServer ? (
                  <span className="badge closed">{summary.leftServer} left</span>
                ) : null}
              </div>

              <div className="member-search-results">
                {results.map((member) => {
                  const displayName =
                    member.display_name ||
                    member.nickname ||
                    member.username ||
                    member.user_id ||
                    "Unknown Member"

                  const avatarUrl = member.avatar_url || null
                  const inGuild = member.in_guild !== false

                  return (
                    <button
                      key={member.user_id}
                      type="button"
                      className="member-search-result"
                      onClick={() => setSelected(member)}
                    >
                      <div className="row" style={{ minWidth: 0, flex: 1 }}>
                        <div className="avatar">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={displayName}
                              width="38"
                              height="38"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            initials(displayName)
                          )}
                        </div>

                        <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: "var(--text-strong)",
                              overflowWrap: "anywhere"
                            }}
                          >
                            {displayName}
                          </div>

                          <div
                            className="muted"
                            style={{
                              marginTop: 4,
                              fontSize: 13,
                              overflowWrap: "anywhere"
                            }}
                          >
                            {member.user_id}
                          </div>
                        </div>
                      </div>

                      <div className="member-search-badges">
                        <span className={`badge ${inGuild ? "claimed" : "closed"}`}>
                          {inGuild ? "In Server" : "Left Server"}
                        </span>

                        <span className={`badge ${member.has_verified_role ? "low" : "medium"}`}>
                          {member.has_verified_role ? "Verified" : "Pending"}
                        </span>

                        <span className="badge">
                          {member.top_role || member.highest_role_name || "No top role"}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <MemberDrawer member={selected} onClose={() => setSelected(null)} />
    </>
  )
}
