"use client";

import { useMemo, useState } from "react";
import { slugify } from "@/lib/format";

const INTAKE_TYPES = [
  { value: "general", label: "General Support" },
  { value: "verification", label: "Verification" },
  { value: "appeal", label: "Appeal" },
  { value: "report", label: "Report / Incident" },
  { value: "partnership", label: "Partnership" },
  { value: "question", label: "Question" },
  { value: "custom", label: "Custom" },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function csvToArray(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function emptyDraft() {
  return {
    name: "",
    color: "#45d483",
    description: "",
    intake_type: "general",
    match_keywords: "",
    button_label: "",
    sort_order: "",
    is_default: false,
  };
}

function categoryPayloadFromDraft(draft) {
  const name = String(draft?.name || "").trim();

  return {
    name,
    slug: slugify(name),
    color: draft?.color || "#45d483",
    description: String(draft?.description || "").trim(),
    intake_type: String(draft?.intake_type || "general").trim(),
    match_keywords: csvToArray(draft?.match_keywords),
    button_label: String(draft?.button_label || "").trim(),
    sort_order:
      draft?.sort_order === "" || draft?.sort_order === null
        ? null
        : Number(draft.sort_order),
    is_default: Boolean(draft?.is_default),
  };
}

function sortCategories(categories, sortBy) {
  const rows = [...safeArray(categories)];

  rows.sort((a, b) => {
    if (sortBy === "name") {
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    }

    if (sortBy === "tickets_desc") {
      return Number(b?._ticketCount || 0) - Number(a?._ticketCount || 0);
    }

    if (sortBy === "tickets_asc") {
      return Number(a?._ticketCount || 0) - Number(b?._ticketCount || 0);
    }

    const orderA = Number(a?.sort_order ?? 9999);
    const orderB = Number(b?.sort_order ?? 9999);
    if (orderA !== orderB) return orderA - orderB;

    if (Boolean(b?.is_default) !== Boolean(a?.is_default)) {
      return b?.is_default ? 1 : -1;
    }

    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });

  return rows;
}

function matchesCategorySearch(category, query) {
  if (!query) return true;

  const q = String(query).trim().toLowerCase();
  if (!q) return true;

  const keywords = Array.isArray(category?.match_keywords)
    ? category.match_keywords
    : [];

  const haystack = [
    category?.name,
    category?.slug,
    category?.description,
    category?.intake_type,
    category?.button_label,
    ...keywords,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function getTicketCountForCategory(category, tickets) {
  const slug = String(category?.slug || "").trim().toLowerCase();
  const name = String(category?.name || "").trim().toLowerCase();

  return safeArray(tickets).filter((ticket) => {
    const rawCategory = String(ticket?.category || "").trim().toLowerCase();
    const matchedSlug = String(ticket?.matched_category_slug || "")
      .trim()
      .toLowerCase();
    const matchedName = String(ticket?.matched_category_name || "")
      .trim()
      .toLowerCase();
    const categoryId = String(ticket?.category_id || "").trim();
    const matchedCategoryId = String(ticket?.matched_category_id || "").trim();

    return (
      (category?.id && categoryId === String(category.id)) ||
      (category?.id && matchedCategoryId === String(category.id)) ||
      (slug && rawCategory === slug) ||
      (name && rawCategory === name) ||
      (slug && matchedSlug === slug) ||
      (name && matchedName === name)
    );
  }).length;
}

function CategoryPreview({ draft }) {
  const payload = categoryPayloadFromDraft(draft);
  const buttonLabel =
    payload.button_label || payload.name || "Category button";
  const keywords = safeArray(payload.match_keywords);

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 16,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          className="status-dot"
          style={{
            width: 12,
            height: 12,
            minWidth: 12,
            background: payload.color || "#45d483",
          }}
        />
        <div
          style={{
            fontWeight: 800,
            color: "var(--text-strong, #f8fafc)",
          }}
        >
          {payload.name || "New category"}
        </div>
        <span className="badge">{payload.intake_type || "general"}</span>
        {payload.is_default ? <span className="badge claimed">Default</span> : null}
      </div>

      <div
        style={{
          fontSize: 13,
          color: "var(--text-muted, rgba(255,255,255,0.72))",
          lineHeight: 1.5,
        }}
      >
        {payload.description || "No description yet."}
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span className="badge low">{buttonLabel}</span>
        {keywords.map((keyword) => (
          <span key={keyword} className="badge">
            {keyword}
          </span>
        ))}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  busyId,
  editingId,
  draft,
  setDraft,
  setEditingId,
  onSave,
  onRemove,
  onStartEdit,
  onFindTickets,
}) {
  const isEditing = editingId === category.id;
  const keywords = safeArray(category?.match_keywords);

  return (
    <div
      className="card"
      style={{
        padding: 14,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      {isEditing ? (
        <div className="space">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr .8fr",
              gap: 10,
            }}
          >
            <input
              className="input"
              value={draft.name}
              placeholder="Category name"
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <input
              className="input"
              type="color"
              value={draft.color}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, color: e.target.value }))
              }
            />
          </div>

          <textarea
            className="input"
            rows={3}
            value={draft.description}
            placeholder="What is this category for?"
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, description: e.target.value }))
            }
            style={{ resize: "vertical" }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <select
              className="input"
              value={draft.intake_type}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, intake_type: e.target.value }))
              }
            >
              {INTAKE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <input
              className="input"
              value={draft.button_label}
              placeholder="Button label"
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, button_label: e.target.value }))
              }
            />
          </div>

          <input
            className="input"
            value={draft.match_keywords}
            placeholder="Keywords / aliases, comma separated"
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, match_keywords: e.target.value }))
            }
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              className="input"
              type="number"
              value={draft.sort_order}
              placeholder="Sort order"
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, sort_order: e.target.value }))
              }
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--text-strong, #f8fafc)",
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(draft.is_default)}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    is_default: e.target.checked,
                  }))
                }
              />
              Default category
            </label>
          </div>

          <CategoryPreview draft={draft} />

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="button"
              disabled={busyId === category.id}
              onClick={() => onSave(category.id)}
            >
              {busyId === category.id ? "Saving…" : "Save"}
            </button>

            <button
              type="button"
              className="button ghost"
              onClick={() => setEditingId("")}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space">
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                className="row"
                style={{
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="status-dot"
                  style={{ background: category.color || "#45d483" }}
                />
                <div
                  style={{
                    fontWeight: 800,
                    color: "var(--text-strong, #f8fafc)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {category.name}
                </div>
                <span className="badge">
                  {category.intake_type || "general"}
                </span>
                {category.is_default ? (
                  <span className="badge claimed">Default</span>
                ) : null}
                <span className="badge low">
                  {Number(category._ticketCount || 0)} ticket
                  {Number(category._ticketCount || 0) === 1 ? "" : "s"}
                </span>
              </div>

              <div
                className="muted"
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  overflowWrap: "anywhere",
                }}
              >
                {category.slug}
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "var(--text-muted, rgba(255,255,255,0.72))",
                  lineHeight: 1.5,
                }}
              >
                {category.description || "No description set."}
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {category.button_label ? (
                  <span className="badge low">{category.button_label}</span>
                ) : null}

                {typeof category.sort_order === "number" ? (
                  <span className="badge">Order {category.sort_order}</span>
                ) : null}

                {keywords.map((keyword) => (
                  <span key={keyword} className="badge">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="button ghost"
                onClick={() => onFindTickets(category)}
              >
                Find Tickets
              </button>

              <button
                type="button"
                className="button ghost"
                onClick={() => onStartEdit(category)}
              >
                Edit
              </button>

              <button
                type="button"
                className="button danger"
                disabled={busyId === category.id}
                onClick={() => onRemove(category.id)}
              >
                {busyId === category.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CategoryManager({
  categories = [],
  tickets = [],
  onRefresh,
  onFindTicketsByCategory,
}) {
  const [createDraft, setCreateDraft] = useState(emptyDraft());
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState(emptyDraft());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("sort_order");

  const enrichedCategories = useMemo(() => {
    return safeArray(categories).map((category) => ({
      ...category,
      _ticketCount: getTicketCountForCategory(category, tickets),
    }));
  }, [categories, tickets]);

  const visibleCategories = useMemo(() => {
    return sortCategories(
      enrichedCategories.filter((category) =>
        matchesCategorySearch(category, search)
      ),
      sortBy
    );
  }, [enrichedCategories, search, sortBy]);

  function flashMessage(text) {
    setMessage(text);
    if (typeof window !== "undefined") {
      window.clearTimeout(window.__categoryManagerMsgTimer);
      window.__categoryManagerMsgTimer = window.setTimeout(() => {
        setMessage("");
      }, 2200);
    }
  }

  async function createCategory(e) {
    e.preventDefault();

    const payload = categoryPayloadFromDraft(createDraft);
    if (!payload.name) return;

    setBusyId("create");
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/ticket-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create category.");
      }

      setCreateDraft(emptyDraft());
      flashMessage("Category created.");
      await onRefresh?.();
    } catch (err) {
      setError(err?.message || "Failed to create category.");
    } finally {
      setBusyId("");
    }
  }

  async function removeCategory(id) {
    setBusyId(id);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/ticket-categories/${id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete category.");
      }

      flashMessage("Category deleted.");
      await onRefresh?.();
    } catch (err) {
      setError(err?.message || "Failed to delete category.");
    } finally {
      setBusyId("");
    }
  }

  async function saveCategory(id) {
    const payload = categoryPayloadFromDraft(editDraft);
    if (!payload.name) {
      setError("Category name is required.");
      return;
    }

    setBusyId(id);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/ticket-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to update category.");
      }

      setEditingId("");
      flashMessage("Category updated.");
      await onRefresh?.();
    } catch (err) {
      setError(err?.message || "Failed to update category.");
    } finally {
      setBusyId("");
    }
  }

  function startEdit(category) {
    setEditingId(category.id);
    setEditDraft({
      name: category.name || "",
      color: category.color || "#45d483",
      description: category.description || "",
      intake_type: category.intake_type || "general",
      match_keywords: normalizeCsv(
        Array.isArray(category.match_keywords)
          ? category.match_keywords.join(", ")
          : category.match_keywords || ""
      ),
      button_label: category.button_label || "",
      sort_order:
        category.sort_order === null || category.sort_order === undefined
          ? ""
          : String(category.sort_order),
      is_default: Boolean(category.is_default),
    });
  }

  function handleFindTickets(category) {
    onFindTicketsByCategory?.(category);
    flashMessage(`Showing tickets for ${category.name}.`);
  }

  const totalCategoryTickets = enrichedCategories.reduce(
    (sum, category) => sum + Number(category._ticketCount || 0),
    0
  );

  return (
    <div className="card" id="categories">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Ticket Categories</h2>
          <div
            className="muted"
            style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}
          >
            Define what each ticket type is for, how it should appear, and jump
            straight into tickets for that category.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span className="badge">
            {enrichedCategories.length} categorie
            {enrichedCategories.length === 1 ? "y" : "s"}
          </span>
          <span className="badge low">
            {totalCategoryTickets} mapped ticket
            {totalCategoryTickets === 1 ? "" : "s"}
          </span>
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

      <form className="space" onSubmit={createCategory}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr .8fr",
            gap: 10,
          }}
        >
          <input
            className="input"
            placeholder="Category name"
            value={createDraft.name}
            onChange={(e) =>
              setCreateDraft((prev) => ({ ...prev, name: e.target.value }))
            }
          />

          <input
            className="input"
            type="color"
            value={createDraft.color}
            onChange={(e) =>
              setCreateDraft((prev) => ({ ...prev, color: e.target.value }))
            }
          />
        </div>

        <textarea
          className="input"
          rows={3}
          placeholder="Describe what this ticket category is for"
          value={createDraft.description}
          onChange={(e) =>
            setCreateDraft((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
          style={{ resize: "vertical" }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <select
            className="input"
            value={createDraft.intake_type}
            onChange={(e) =>
              setCreateDraft((prev) => ({
                ...prev,
                intake_type: e.target.value,
              }))
            }
          >
            {INTAKE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <input
            className="input"
            placeholder="Button label"
            value={createDraft.button_label}
            onChange={(e) =>
              setCreateDraft((prev) => ({
                ...prev,
                button_label: e.target.value,
              }))
            }
          />
        </div>

        <input
          className="input"
          placeholder="Keywords / aliases, comma separated"
          value={createDraft.match_keywords}
          onChange={(e) =>
            setCreateDraft((prev) => ({
              ...prev,
              match_keywords: e.target.value,
            }))
          }
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            className="input"
            type="number"
            placeholder="Sort order"
            value={createDraft.sort_order}
            onChange={(e) =>
              setCreateDraft((prev) => ({
                ...prev,
                sort_order: e.target.value,
              }))
            }
          />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--text-strong, #f8fafc)",
              whiteSpace: "nowrap",
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(createDraft.is_default)}
              onChange={(e) =>
                setCreateDraft((prev) => ({
                  ...prev,
                  is_default: e.target.checked,
                }))
              }
            />
            Default category
          </label>
        </div>

        <CategoryPreview draft={createDraft} />

        <button
          className="button primary"
          type="submit"
          disabled={busyId === "create"}
        >
          {busyId === "create" ? "Adding…" : "Add Category"}
        </button>
      </form>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1.2fr .8fr",
          marginTop: 14,
          marginBottom: 14,
        }}
      >
        <input
          className="input"
          placeholder="Search categories, keywords, intake type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="input"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="sort_order">Sort by layout order</option>
          <option value="name">Sort by name</option>
          <option value="tickets_desc">Most tickets first</option>
          <option value="tickets_asc">Least tickets first</option>
        </select>
      </div>

      <div className="space">
        {!visibleCategories.length ? (
          <div className="empty-state">
            {enrichedCategories.length
              ? "No categories match your search."
              : "No categories found."}
          </div>
        ) : null}

        {visibleCategories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            busyId={busyId}
            editingId={editingId}
            draft={editDraft}
            setDraft={setEditDraft}
            setEditingId={setEditingId}
            onSave={saveCategory}
            onRemove={removeCategory}
            onStartEdit={startEdit}
            onFindTickets={handleFindTickets}
          />
        ))}
      </div>
    </div>
  );
}
