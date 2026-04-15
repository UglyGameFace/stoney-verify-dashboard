"use client";

import { useMemo, useState } from "react";

type NoteRow = {
  id?: string | number | null;
  ticket_id?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  content?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type NotesApiResponse = {
  ok?: boolean;
  error?: string;
  note?: NoteRow | null;
  notes?: NoteRow[];
};

type TicketNotesPanelProps = {
  ticketId: string;
  notes?: NoteRow[];
  onSaved?: (() => Promise<void> | void) | null;
};

type FilterMode = "all" | "recent" | "long" | "handoff";

type QuickTemplate = {
  label: string;
  value: string;
};

const MAX_NOTE_LENGTH = 4000;

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function formatDateTime(value: unknown): string {
  if (!value) return "—";
  try {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  } catch {
    return "—";
  }
}

function safeNotes(value: unknown): NoteRow[] {
  return Array.isArray(value) ? (value as NoteRow[]) : [];
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function looksLikeHandoff(value: unknown): boolean {
  const text = normalizeText(value);
  return (
    text.includes("handoff") ||
    text.includes("next staff") ||
    text.includes("follow up") ||
    text.includes("follow-up") ||
    text.includes("waiting on") ||
    text.includes("pending from") ||
    text.includes("need to check")
  );
}

function countDistinctAuthors(notes: NoteRow[]): number {
  return new Set(
    notes
      .map((note) => safeText(note?.staff_name || note?.staff_id, ""))
      .filter(Boolean)
  ).size;
}

function latestNoteDate(notes: NoteRow[]): string {
  if (!notes.length) return "—";

  const latest = [...notes].sort((a, b) => {
    const aTime = new Date(String(a?.created_at || "")).getTime() || 0;
    const bTime = new Date(String(b?.created_at || "")).getTime() || 0;
    return bTime - aTime;
  })[0];

  return formatDateTime(latest?.created_at);
}

function buildHandoffSummary(notes: NoteRow[]): string {
  if (!notes.length) return "No internal notes yet.";

  const latest = [...notes].sort((a, b) => {
    const aTime = new Date(String(a?.created_at || "")).getTime() || 0;
    const bTime = new Date(String(b?.created_at || "")).getTime() || 0;
    return bTime - aTime;
  });

  return latest
    .slice(0, 3)
    .map((note, index) => {
      const author = safeText(note?.staff_name || note?.staff_id, "Unknown Staff");
      const when = formatDateTime(note?.created_at);
      const body = safeText(note?.content, "No note content.");
      return `${index + 1}. ${author} • ${when}\n${body}`;
    })
    .join("\n\n");
}

export default function TicketNotesPanel({
  ticketId,
  notes = [],
  onSaved,
}: TicketNotesPanelProps) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const quickTemplates: QuickTemplate[] = [
    {
      label: "Handoff",
      value:
        "Handoff:\n- Current state:\n- Waiting on:\n- Next staff action:\n- Risks / watch items:\n",
    },
    {
      label: "Follow-up",
      value:
        "Follow-up needed:\n- What still needs review:\n- Who needs to respond:\n- What blocks closure:\n",
    },
    {
      label: "Verification",
      value:
        "Verification review note:\n- Token / VC status:\n- Role state:\n- Flags / concerns:\n- Recommended next step:\n",
    },
    {
      label: "Decision",
      value:
        "Decision note:\n- Action taken:\n- Reason:\n- What changes in the ticket/member state now:\n",
    },
  ];

  const cleanedNotes = useMemo(() => safeNotes(notes), [notes]);

  const stats = useMemo(() => {
    const handoffCount = cleanedNotes.filter((note) =>
      looksLikeHandoff(note?.content)
    ).length;

    return {
      total: cleanedNotes.length,
      authors: countDistinctAuthors(cleanedNotes),
      latestAt: latestNoteDate(cleanedNotes),
      handoffs: handoffCount,
    };
  }, [cleanedNotes]);

  const filteredNotes = useMemo(() => {
    const query = normalizeText(search);

    return cleanedNotes.filter((note) => {
      const text = safeText(note?.content, "");
      const author = safeText(note?.staff_name || note?.staff_id, "");
      const createdAt = String(note?.created_at || "");

      if (filterMode === "recent") {
        const ts = new Date(createdAt).getTime() || 0;
        const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
        if (Date.now() - ts > twoDaysMs) return false;
      }

      if (filterMode === "long" && text.length < 180) return false;
      if (filterMode === "handoff" && !looksLikeHandoff(text)) return false;

      if (!query) return true;

      const haystack = `${author} ${text} ${createdAt}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [cleanedNotes, filterMode, search]);

  async function saveNote() {
    const content = String(draft || "").trim();
    if (!content) return;

    if (content.length > MAX_NOTE_LENGTH) {
      setError(`Note is too long. Maximum ${MAX_NOTE_LENGTH} characters.`);
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/tickets/${ticketId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ content }),
      });

      const json = (await res.json().catch(() => null)) as NotesApiResponse | null;

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save internal note.");
      }

      setDraft("");
      setMessage("Internal note saved.");
      await onSaved?.();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save internal note."));
    } finally {
      setSaving(false);
    }
  }

  async function copyHandoffSummary() {
    setCopying(true);
    setError("");
    setMessage("");

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard is not available on this device.");
      }

      await navigator.clipboard.writeText(buildHandoffSummary(cleanedNotes));
      setMessage("Handoff summary copied.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not copy handoff summary."));
    } finally {
      setCopying(false);
    }
  }

  function appendTemplate(value: string) {
    setDraft((prev) => {
      const current = String(prev || "").trim();
      if (!current) return value;
      return `${current}\n\n${value}`;
    });
  }

  return (
    <div className="card notes-panel-card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Internal Notes</h2>
          <div className="muted" style={{ overflowWrap: "anywhere" }}>
            Staff memory, handoff context, and decision breadcrumbs that make the
            next person faster and less likely to miss something.
          </div>
        </div>

        <div className="notes-summary-pills">
          <span className="notes-summary-pill">{stats.total} total</span>
          <span className="notes-summary-pill info">{stats.authors} authors</span>
          <span className="notes-summary-pill warn">{stats.handoffs} handoffs</span>
        </div>
      </div>

      {error ? (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="info-banner" style={{ marginBottom: 12 }}>
          {message}
        </div>
      ) : null}

      <div className="notes-stats-grid">
        <div className="notes-stat-card">
          <div className="notes-stat-label">Latest Note</div>
          <div className="notes-stat-value">{stats.latestAt}</div>
        </div>

        <div className="notes-stat-card">
          <div className="notes-stat-label">Visible Notes</div>
          <div className="notes-stat-value">{filteredNotes.length}</div>
        </div>

        <div className="notes-stat-card">
          <div className="notes-stat-label">Handoff-Style Notes</div>
          <div className="notes-stat-value">{stats.handoffs}</div>
        </div>
      </div>

      <div className="notes-compose-box">
        <div className="notes-compose-head">
          <div className="notes-compose-title">Write Staff Note</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Great notes explain current state, blockers, next action, and risk.
          </div>
        </div>

        <textarea
          className="textarea"
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add internal note..."
        />

        <div className="notes-compose-meta">
          <div className="muted" style={{ fontSize: 12 }}>
            {draft.trim().length}/{MAX_NOTE_LENGTH}
          </div>
        </div>

        <div className="notes-template-row">
          {quickTemplates.map((template) => (
            <button
              key={template.label}
              type="button"
              className="notes-template-chip"
              disabled={saving}
              onClick={() => appendTemplate(template.value)}
            >
              {template.label}
            </button>
          ))}
        </div>

        <div className="notes-compose-actions">
          <button
            className="button ghost"
            type="button"
            disabled={copying}
            onClick={() => void copyHandoffSummary()}
            style={{ width: "auto", minWidth: 190 }}
          >
            {copying ? "Copying..." : "Copy Handoff Summary"}
          </button>

          <button
            className="button primary"
            type="button"
            disabled={saving || !draft.trim()}
            onClick={() => void saveNote()}
            style={{ width: "auto", minWidth: 150 }}
          >
            {saving ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>

      <div className="notes-toolbar">
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes..."
        />

        <select
          className="input"
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
        >
          <option value="all">All Notes</option>
          <option value="recent">Recent Only</option>
          <option value="long">Long Notes</option>
          <option value="handoff">Handoff Style</option>
        </select>
      </div>

      <div className="notes-list">
        {!filteredNotes.length ? (
          <div className="empty-state">
            {cleanedNotes.length
              ? "No notes match the current filter."
              : "No internal notes yet."}
          </div>
        ) : null}

        {filteredNotes.map((note, index) => {
          const author = safeText(note?.staff_name || note?.staff_id, "Unknown Staff");
          const handoff = looksLikeHandoff(note?.content);

          return (
            <div
              key={String(note?.id || `${note?.created_at || "note"}-${index}`)}
              className={`note-item-card ${handoff ? "handoff" : ""}`}
            >
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="note-item-author-row">
                    <div className="note-item-author">{author}</div>
                    <span className="note-kind-pill">Internal</span>
                    {handoff ? (
                      <span className="note-kind-pill handoff">Handoff</span>
                    ) : null}
                  </div>

                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {formatDateTime(note?.created_at)}
                  </div>
                </div>
              </div>

              <div className="note-item-body">
                {safeText(note?.content, "No note content.")}
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .notes-panel-card {
          background:
            radial-gradient(circle at top right, rgba(251,191,36,0.06), transparent 28%),
            radial-gradient(circle at bottom left, rgba(99,213,255,0.05), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
        }

        .notes-summary-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .notes-summary-pill {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .notes-summary-pill.info {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .notes-summary-pill.warn {
          border-color: rgba(251,191,36,0.22);
          background: rgba(251,191,36,0.08);
        }

        .notes-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .notes-stat-card {
          display: grid;
          gap: 4px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .notes-stat-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted, #9fb0c3);
        }

        .notes-stat-value {
          color: var(--text, #dbe4ee);
          overflow-wrap: anywhere;
        }

        .notes-compose-box {
          display: grid;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            radial-gradient(circle at top right, rgba(251,191,36,0.07), transparent 42%),
            rgba(255,255,255,0.02);
          margin-bottom: 14px;
        }

        .notes-compose-head {
          display: grid;
          gap: 4px;
        }

        .notes-compose-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted, #9fb0c3);
        }

        .notes-compose-meta {
          display: flex;
          justify-content: flex-end;
        }

        .notes-template-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .notes-template-chip {
          appearance: none;
          border: 1px solid rgba(251,191,36,0.18);
          background: rgba(251,191,36,0.08);
          color: var(--text, #dbe4ee);
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          cursor: pointer;
        }

        .notes-template-chip:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .notes-compose-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
        }

        .notes-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 220px;
          gap: 10px;
          margin-bottom: 14px;
        }

        .notes-list {
          display: grid;
          gap: 12px;
        }

        .note-item-card {
          display: grid;
          gap: 10px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .note-item-card.handoff {
          border-color: rgba(251,191,36,0.18);
          background:
            radial-gradient(circle at top right, rgba(251,191,36,0.08), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .note-item-author-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .note-item-author {
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .note-kind-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: var(--text, #dbe4ee);
        }

        .note-kind-pill.handoff {
          border-color: rgba(251,191,36,0.22);
          background: rgba(251,191,36,0.08);
        }

        .note-item-body {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.55;
          color: var(--text, #dbe4ee);
        }

        @media (max-width: 860px) {
          .notes-stats-grid,
          .notes-toolbar {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .notes-compose-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .notes-compose-actions :global(.button) {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
