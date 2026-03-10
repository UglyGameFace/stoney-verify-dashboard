"use client"

import { useState } from "react"
import { slugify } from "@/lib/format"

export default function CategoryManager({ categories = [], onRefresh }) {
  const [name, setName] = useState("")
  const [color, setColor] = useState("#45d483")
  const [busyId, setBusyId] = useState("")
  const [editingId, setEditingId] = useState("")
  const [draftName, setDraftName] = useState("")
  const [draftColor, setDraftColor] = useState("#45d483")
  const [error, setError] = useState("")

  async function createCategory(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusyId("create")
    setError("")
    try {
      const res = await fetch("/api/ticket-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slugify(name), color })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to create category.")
      setName("")
      await onRefresh()
    } catch (err) {
      setError(err.message || "Failed to create category.")
    } finally {
      setBusyId("")
    }
  }

  async function removeCategory(id) {
    setBusyId(id)
    setError("")
    try {
      const res = await fetch(`/api/ticket-categories/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to delete category.")
      await onRefresh()
    } catch (err) {
      setError(err.message || "Failed to delete category.")
    } finally {
      setBusyId("")
    }
  }

  async function saveCategory(id) {
    setBusyId(id)
    setError("")
    try {
      const res = await fetch(`/api/ticket-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName, slug: slugify(draftName), color: draftColor })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to update category.")
      setEditingId("")
      await onRefresh()
    } catch (err) {
      setError(err.message || "Failed to update category.")
    } finally {
      setBusyId("")
    }
  }

  function startEdit(category) {
    setEditingId(category.id)
    setDraftName(category.name)
    setDraftColor(category.color)
  }

  return (
    <div className="card" id="categories">
      <h2 style={{ marginTop: 0 }}>Ticket Categories</h2>
      {error ? <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div> : null}

      <form className="space" onSubmit={createCategory}>
        <input className="input" placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button className="button primary" type="submit" disabled={busyId === "create"}>{busyId === "create" ? "Adding…" : "Add Category"}</button>
      </form>

      <div className="space" style={{ marginTop: 14 }}>
        {!categories.length ? <div className="empty-state">No categories found.</div> : null}
        {categories.map((category) => (
          <div key={category.id} className="card tight">
            {editingId === category.id ? (
              <div className="space">
                <input className="input" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                <input className="input" type="color" value={draftColor} onChange={(e) => setDraftColor(e.target.value)} />
                <div className="row">
                  <button type="button" className="button primary" disabled={busyId === category.id} onClick={() => saveCategory(category.id)}>
                    {busyId === category.id ? "Saving…" : "Save"}
                  </button>
                  <button type="button" className="button ghost" onClick={() => setEditingId("")}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="row">
                  <span className="status-dot" style={{ background: category.color }} />
                  <div>
                    <div style={{ fontWeight: 800 }}>{category.name}</div>
                    <div className="muted">{category.slug}</div>
                  </div>
                </div>
                <div className="row">
                  <button type="button" className="button ghost" onClick={() => startEdit(category)}>Edit</button>
                  <button type="button" className="button danger" disabled={busyId === category.id} onClick={() => removeCategory(category.id)}>
                    {busyId === category.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
