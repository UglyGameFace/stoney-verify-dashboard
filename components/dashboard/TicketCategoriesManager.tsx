"use client";

import { useEffect, useMemo, useState } from "react";

type TicketCategory = {
  id?: string | null;
  guild_id?: string | null;
  name?: string | null;
  slug?: string | null;
  color?: string | null;
  description?: string | null;
  intake_type?: string | null;
  match_keywords?: string[] | null;
  button_label?: string | null;
  sort_order?: number | null;
  is_default?: boolean | null;
  created_at?: string | null;
  keyword_count?: number | null;
  usage?: {
    total?: number;
    open?: number;
    claimed?: number;
    closed?: number;
    deleted?: number;
    manualOverrideCount?: number;
    latestTicketAt?: string | null;
  } | null;
};

type LinkedTicketPreview = {
  id?: string | null;
  title?: string | null;
  status?: string | null;
};

type CategoriesResponse = {
  categories?: TicketCategory[];
  defaultCategoryId?: string | null;
  presets?: Record<string, string[]>;
  codServiceKeywords?: string[];
  error?: string;
};

type MutationResponse = {
  ok?: boolean;
  error?: string;
  category?: TicketCategory | null;
  deletedId?: string | null;
  linkedTickets?: LinkedTicketPreview[];
};

type FormState = {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string;
  intake_type: string;
  match_keywords: string;
  button_label: string;
  sort_order: string;
  is_default: boolean;
};

type StarterTemplate = {
  key: string;
  title: string;
  helper: string;
  form: FormState;
};

const DEFAULT_FORM: FormState = {
  id: "",
  name: "",
  slug: "",
  color: "#45d483",
  description: "",
  intake_type: "general",
  match_keywords: "",
  button_label: "",
  sort_order: "",
  is_default: false,
};

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: "support",
    title: "General Support",
    helper: "Default catch-all for normal questions and help requests.",
    form: {
      ...DEFAULT_FORM,
      name: "General Support",
      slug: "general-support",
      color: "#45d483",
      description: "General help, questions, and server support.",
      intake_type: "general",
      match_keywords: "support, help, general support, assistance, question",
      button_label: "Open Support Ticket",
      sort_order: "10",
      is_default: true,
    },
  },
  {
    key: "verification",
    title: "Verification Issue",
    helper: "For ID/VC/role verification problems.",
    form: {
      ...DEFAULT_FORM,
      name: "Verification Issue",
      slug: "verification-issue",
      color: "#63d5ff",
      description: "Verification help, role issues, ID review, or VC verification support.",
      intake_type: "verification",
      match_keywords: "verification, verify, id verification, vc verify, role issue, verified role, unverified",
      button_label: "Open Verification Ticket",
      sort_order: "20",
      is_default: false,
    },
  },
  {
    key: "appeals",
    title: "Appeals / Reports",
    helper: "Moderation reports, ban appeals, and staff review requests.",
    form: {
      ...DEFAULT_FORM,
      name: "Appeals / Reports",
      slug: "appeals-reports",
      color: "#ffd36b",
      description: "Ban appeals, moderation questions, user reports, and staff review requests.",
      intake_type: "appeal",
      match_keywords: "appeal, ban appeal, report, moderation, staff review, blacklist, timeout",
      button_label: "Open Appeal Ticket",
      sort_order: "30",
      is_default: false,
    },
  },
  {
    key: "cod-service",
    title: "COD / Service Support",
    helper: "For modded lobbies, older COD support, and service questions.",
    form: {
      ...DEFAULT_FORM,
      name: "COD / Service Support",
      slug: "cod-service-support",
      color: "#b26dff",
      description: "Support for COD services, modded lobbies, older Call of Duty titles, and hosted service questions.",
      intake_type: "custom",
      match_keywords: "cod, call of duty, modded lobby, modded lobbies, black ops, black ops 2, black ops 3, mw2, mw3, zombies, unlock all, recovery, service",
      button_label: "Open COD Support Ticket",
      sort_order: "40",
      is_default: false,
    },
  },
];

const INTAKE_TYPES = ["general", "verification", "appeal", "report", "partnership", "question", "custom"];

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function slugify(value: unknown): string {
  return normalizeString(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDateTime(value: unknown): string {
  if (!value) return "—";
  try {
    return new Date(String(value)).toLocaleString();
  } catch {
    return "—";
  }
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function keywordsToString(value: unknown): string {
  return safeArray<string>(value).map((item) => normalizeString(item)).filter(Boolean).join(", ");
}

function buildFormFromCategory(category: TicketCategory | null): FormState {
  if (!category) return { ...DEFAULT_FORM };
  return {
    id: normalizeString(category.id),
    name: normalizeString(category.name),
    slug: normalizeString(category.slug),
    color: normalizeString(category.color) || "#45d483",
    description: normalizeString(category.description),
    intake_type: normalizeString(category.intake_type) || "general",
    match_keywords: keywordsToString(category.match_keywords),
    button_label: normalizeString(category.button_label),
    sort_order: category.sort_order === null || category.sort_order === undefined ? "" : String(category.sort_order),
    is_default: Boolean(category.is_default),
  };
}

function usageCount(category: TicketCategory, key: keyof NonNullable<TicketCategory["usage"]>) {
  return Number(category?.usage?.[key] || 0);
}

export default function TicketCategoriesManager() {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>("");
  const [presets, setPresets] = useState<Record<string, string[]>>({});
  const [codKeywords, setCodKeywords] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string>("");
  const [starterSavingKey, setStarterSavingKey] = useState<string>("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedCategory = useMemo(() => categories.find((row) => normalizeString(row.id) === selectedId) || null, [categories, selectedId]);
  const filteredCategories = useMemo(() => {
    const q = normalizeLower(search);
    if (!q) return categories;
    return categories.filter((category) => {
      const haystack = [category.name, category.slug, category.description, category.intake_type, category.button_label, ...safeArray<string>(category.match_keywords)].map(normalizeString).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [categories, search]);
  const presetKeywords = useMemo(() => safeArray<string>(presets[normalizeString(form.intake_type)]), [presets, form.intake_type]);

  async function loadCategories(options?: { preserveSelection?: boolean }) {
    const preserveSelection = options?.preserveSelection ?? true;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ticket-categories", { method: "GET", cache: "no-store", headers: { "Cache-Control": "no-store, max-age=0" } });
      const json = (await res.json().catch(() => null)) as CategoriesResponse | null;
      if (!res.ok) throw new Error(json?.error || "Failed to load ticket categories.");
      const nextCategories = safeArray<TicketCategory>(json?.categories || []);
      setCategories(nextCategories);
      setDefaultCategoryId(normalizeString(json?.defaultCategoryId));
      setPresets((json?.presets || {}) as Record<string, string[]>);
      setCodKeywords(safeArray<string>(json?.codServiceKeywords || []));
      if (!preserveSelection) {
        setSelectedId("");
        setForm({ ...DEFAULT_FORM });
        return;
      }
      if (selectedId) {
        const fresh = nextCategories.find((row) => normalizeString(row.id) === selectedId);
        if (fresh) setForm(buildFormFromCategory(fresh));
        else {
          setSelectedId("");
          setForm({ ...DEFAULT_FORM });
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load ticket categories."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories({ preserveSelection: false });
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name") {
        const currentSlug = normalizeString(prev.slug);
        const previousAutoSlug = slugify(prev.name);
        if (!currentSlug || currentSlug === previousAutoSlug) next.slug = slugify(value);
      }
      return next;
    });
  }

  function resetForm() {
    setSelectedId("");
    setForm({ ...DEFAULT_FORM });
    setError("");
    setMessage("");
  }

  function startCreate() {
    resetForm();
  }

  function startTemplate(template: StarterTemplate) {
    setSelectedId("");
    setForm({ ...template.form });
    setError("");
    setMessage(`${template.title} starter loaded. Review it, then save.`);
  }

  function startEdit(category: TicketCategory) {
    const id = normalizeString(category.id);
    setSelectedId(id);
    setForm(buildFormFromCategory(category));
    setError("");
    setMessage("");
  }

  function appendPresetKeywords(items: string[]) {
    const existing = form.match_keywords.split(",").map((item) => item.trim()).filter(Boolean);
    const merged = [...existing];
    for (const item of items) {
      const clean = normalizeString(item);
      if (!clean) continue;
      if (!merged.some((existingItem) => existingItem.toLowerCase() === clean.toLowerCase())) merged.push(clean);
    }
    setField("match_keywords", merged.join(", "));
  }

  async function savePayload(payload: Omit<FormState, "id"> & { id?: string }) {
    const method = payload.id ? "PATCH" : "POST";
    const res = await fetch("/api/ticket-categories", {
      method,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        id: payload.id || undefined,
        name: normalizeString(payload.name),
        slug: slugify(payload.slug || payload.name),
        color: normalizeString(payload.color) || "#45d483",
        description: normalizeString(payload.description),
        intake_type: normalizeString(payload.intake_type) || "general",
        match_keywords: payload.match_keywords.split(",").map((item) => item.trim()).filter(Boolean),
        button_label: normalizeString(payload.button_label),
        sort_order: normalizeString(payload.sort_order),
        is_default: Boolean(payload.is_default),
      }),
    });
    const json = (await res.json().catch(() => null)) as MutationResponse | null;
    if (!res.ok || (json && json.error)) throw new Error(json?.error || "Failed to save category.");
    return json;
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (!normalizeString(form.name)) throw new Error("Category name is required.");
      const json = await savePayload(form);
      setMessage(form.id ? "Category updated." : "Category created.");
      const savedCategory = json?.category || null;
      const savedId = normalizeString(savedCategory?.id);
      await loadCategories({ preserveSelection: false });
      if (savedId) {
        setSelectedId(savedId);
        setForm(buildFormFromCategory(savedCategory));
      } else resetForm();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save category."));
    } finally {
      setSaving(false);
    }
  }

  async function createStarter(template: StarterTemplate) {
    setStarterSavingKey(template.key);
    setError("");
    setMessage("");
    try {
      const json = await savePayload(template.form);
      setMessage(`${template.title} category created.`);
      const savedCategory = json?.category || null;
      const savedId = normalizeString(savedCategory?.id);
      await loadCategories({ preserveSelection: false });
      if (savedId) {
        setSelectedId(savedId);
        setForm(buildFormFromCategory(savedCategory));
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Failed to create ${template.title}.`));
    } finally {
      setStarterSavingKey("");
    }
  }

  async function createAllStarters() {
    setStarterSavingKey("all");
    setError("");
    setMessage("");
    try {
      for (const template of STARTER_TEMPLATES) await savePayload(template.form);
      setMessage("Starter ticket categories created. Next: set up ticket forms, then post your panel.");
      await loadCategories({ preserveSelection: false });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to create starter categories."));
    } finally {
      setStarterSavingKey("");
    }
  }

  async function handleDelete(category: TicketCategory) {
    const id = normalizeString(category.id);
    if (!id) return;
    const confirmed = window.confirm(`Delete "${normalizeString(category.name) || "this category"}"?`);
    if (!confirmed) return;
    setDeletingId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/ticket-categories?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "Cache-Control": "no-store" } });
      const json = (await res.json().catch(() => null)) as MutationResponse | null;
      if (!res.ok || (json && json.error)) {
        const linkedTickets = safeArray<LinkedTicketPreview>(json?.linkedTickets || []);
        if (linkedTickets.length) {
          const linkedPreview = linkedTickets.slice(0, 3).map((ticket) => `${ticket.title || "Untitled"} (${ticket.status || "unknown"})`).join(" • ");
          throw new Error(`${json?.error || "Category still linked to tickets."}${linkedPreview ? ` ${linkedPreview}` : ""}`);
        }
        throw new Error(json?.error || "Failed to delete category.");
      }
      if (selectedId === id) resetForm();
      setMessage("Category deleted.");
      await loadCategories({ preserveSelection: false });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to delete category."));
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="space">
      <div className="card category-workflow-card">
        <div className="category-workflow-head">
          <div>
            <div className="muted category-eyebrow">Step 2 of 3</div>
            <h2 style={{ margin: 0 }}>Ticket Categories</h2>
            <div className="muted category-copy">Categories control what members pick in Discord and how tickets route to staff.</div>
          </div>
          <div className="category-top-actions">
            <button type="button" className="button ghost" onClick={() => void loadCategories()} disabled={loading || saving || !!deletingId}> {loading ? "Refreshing..." : "Refresh"}</button>
            <button type="button" className="button primary" onClick={startCreate}>New Category</button>
          </div>
        </div>
        <div className="category-workflow-steps">
          <div><strong>1</strong><span>Create categories</span></div>
          <div><strong>2</strong><span>Add forms/questions</span></div>
          <div><strong>3</strong><span>Post/update Discord panel</span></div>
        </div>
        {error ? <div className="error-banner" style={{ marginTop: 12 }}>{error}</div> : null}
        {message ? <div className="info-banner" style={{ marginTop: 12 }}>{message}</div> : null}
      </div>

      {!loading && categories.length === 0 ? (
        <div className="card starter-card">
          <div className="starter-head">
            <div>
              <div className="muted category-eyebrow">Fast Setup</div>
              <h2 style={{ margin: 0 }}>Start with proven ticket categories</h2>
              <div className="muted category-copy">Skip the blank page. Add safe defaults now, then edit the names/keywords any time.</div>
            </div>
            <button type="button" className="button primary starter-all" onClick={() => void createAllStarters()} disabled={Boolean(starterSavingKey)}>{starterSavingKey === "all" ? "Creating..." : "Create Starter Set"}</button>
          </div>
          <div className="starter-grid">
            {STARTER_TEMPLATES.map((template) => (
              <div key={template.key} className="starter-template-card">
                <div className="starter-template-title">{template.title}</div>
                <div className="muted starter-template-helper">{template.helper}</div>
                <div className="starter-template-actions">
                  <button type="button" className="button ghost" onClick={() => startTemplate(template)} disabled={Boolean(starterSavingKey)}>Preview</button>
                  <button type="button" className="button primary" onClick={() => void createStarter(template)} disabled={Boolean(starterSavingKey)}>{starterSavingKey === template.key ? "Creating..." : "Create"}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="ticket-category-shell">
          <div className="ticket-category-list-card">
            <div className="ticket-category-toolbar"><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories..." /></div>
            <div className="ticket-category-list">
              {!filteredCategories.length && !loading ? <div className="empty-state">No categories found.</div> : null}
              {filteredCategories.map((category) => {
                const id = normalizeString(category.id);
                const selected = selectedId === id;
                return (
                  <button key={id || normalizeString(category.slug)} type="button" className={`ticket-category-row ${selected ? "active" : ""}`} onClick={() => startEdit(category)}>
                    <div className="ticket-category-row-top">
                      <div className="ticket-category-name-wrap"><span className="ticket-category-color" style={{ background: normalizeString(category.color) || "#45d483" }} /><span className="ticket-category-name">{normalizeString(category.name) || "Unnamed"}</span></div>
                      <div className="ticket-category-chip-row">{category.is_default ? <span className="badge claimed">Default</span> : null}<span className="badge">{normalizeString(category.intake_type) || "general"}</span></div>
                    </div>
                    <div className="ticket-category-meta"><span>{normalizeString(category.slug) || "—"}</span><span>•</span><span>{Number(category.keyword_count || category.match_keywords?.length || 0)} keywords</span><span>•</span><span>{usageCount(category, "total")} tickets</span></div>
                    <div className="ticket-category-usage-row"><span>Open {usageCount(category, "open")}</span><span>Claimed {usageCount(category, "claimed")}</span><span>Closed {usageCount(category, "closed")}</span><span>Overrides {usageCount(category, "manualOverrideCount")}</span></div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ticket-category-editor-card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ minWidth: 0, flex: 1 }}><h3 style={{ margin: 0 }}>{form.id ? "Edit Category" : "Create Category"}</h3><div className="muted" style={{ marginTop: 6 }}>Keep routing tight and predictable. This powers the Discord ticket menu and dashboard routing.</div></div>
              {form.id ? <button type="button" className="button ghost" onClick={resetForm} style={{ width: "auto" }}>Clear</button> : null}
            </div>
            <div className="ticket-category-form-grid">
              <div className="ticket-info-item"><span className="ticket-info-label">Name</span><input className="input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Verification Issue" /></div>
              <div className="ticket-info-item"><span className="ticket-info-label">Slug</span><input className="input" value={form.slug} onChange={(e) => setField("slug", slugify(e.target.value))} placeholder="verification-issue" /></div>
              <div className="ticket-info-item"><span className="ticket-info-label">Color</span><div className="ticket-color-row"><input type="color" className="ticket-color-picker" value={form.color || "#45d483"} onChange={(e) => setField("color", e.target.value)} /><input className="input" value={form.color} onChange={(e) => setField("color", e.target.value)} placeholder="#45d483" /></div></div>
              <div className="ticket-info-item"><span className="ticket-info-label">Intake Type</span><select className="input" value={form.intake_type} onChange={(e) => setField("intake_type", e.target.value)}>{INTAKE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
              <div className="ticket-info-item"><span className="ticket-info-label">Button Label</span><input className="input" value={form.button_label} onChange={(e) => setField("button_label", e.target.value)} placeholder="Open Verification Ticket" /></div>
              <div className="ticket-info-item"><span className="ticket-info-label">Sort Order</span><input className="input" value={form.sort_order} onChange={(e) => setField("sort_order", e.target.value)} placeholder="10" /></div>
              <div className="ticket-info-item full"><span className="ticket-info-label">Description</span><textarea className="textarea" rows={3} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="What this category is for..." /></div>
              <div className="ticket-info-item full"><span className="ticket-info-label">Match Keywords</span><textarea className="textarea" rows={4} value={form.match_keywords} onChange={(e) => setField("match_keywords", e.target.value)} placeholder="verification, verify, id verification, vc verify" /></div>
              <div className="ticket-info-item full"><label className="ticket-check-row"><input type="checkbox" checked={form.is_default} onChange={(e) => setField("is_default", e.target.checked)} /><span>Set as default category</span></label></div>
            </div>
            <div className="ticket-category-preset-box"><div className="ticket-preset-title">Preset Keywords</div><div className="ticket-preset-chip-row">{presetKeywords.length ? presetKeywords.map((keyword) => <button key={keyword} type="button" className="ticket-keyword-chip" onClick={() => appendPresetKeywords([keyword])}>+ {keyword}</button>) : <span className="muted">No preset keywords for this intake type.</span>}</div>{normalizeLower(form.intake_type) === "custom" ? <div style={{ marginTop: 12 }}><div className="ticket-preset-title">COD / Service Keywords</div><div className="ticket-preset-chip-row">{codKeywords.slice(0, 18).map((keyword) => <button key={keyword} type="button" className="ticket-keyword-chip ghost" onClick={() => appendPresetKeywords([keyword])}>+ {keyword}</button>)}</div></div> : null}</div>
            {selectedCategory ? <div className="ticket-category-usage-panel"><div className="ticket-preset-title">Current Usage</div><div className="ticket-category-usage-grid"><div className="member-detail-item"><div className="ticket-info-label">Total</div><div>{usageCount(selectedCategory, "total")}</div></div><div className="member-detail-item"><div className="ticket-info-label">Open</div><div>{usageCount(selectedCategory, "open")}</div></div><div className="member-detail-item"><div className="ticket-info-label">Claimed</div><div>{usageCount(selectedCategory, "claimed")}</div></div><div className="member-detail-item"><div className="ticket-info-label">Closed</div><div>{usageCount(selectedCategory, "closed")}</div></div><div className="member-detail-item"><div className="ticket-info-label">Deleted</div><div>{usageCount(selectedCategory, "deleted")}</div></div><div className="member-detail-item"><div className="ticket-info-label">Overrides</div><div>{usageCount(selectedCategory, "manualOverrideCount")}</div></div><div className="member-detail-item full"><div className="ticket-info-label">Latest Ticket Activity</div><div>{formatDateTime(selectedCategory?.usage?.latestTicketAt)}</div></div></div></div> : null}
            <div className="ticket-editor-actions"><button type="button" className="button primary" onClick={() => void handleSave()} disabled={saving} style={{ width: "auto", minWidth: 160 }}>{saving ? "Saving..." : form.id ? "Save Changes" : "Create Category"}</button>{form.id ? <button type="button" className="button danger" onClick={() => selectedCategory && void handleDelete(selectedCategory)} disabled={deletingId === form.id} style={{ width: "auto", minWidth: 160 }}>{deletingId === form.id ? "Deleting..." : "Delete Category"}</button> : null}<a className="button ghost" href="/ticket-forms" style={{ width: "auto", minWidth: 160 }}>Next: Ticket Forms</a></div>
            <div className="ticket-editor-footnote">Default category: <strong>{categories.find((row) => normalizeString(row.id) === defaultCategoryId)?.name || "None"}</strong></div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .category-workflow-card,.starter-card{display:grid;gap:14px}.category-workflow-head,.starter-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}.category-eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:950;margin-bottom:8px}.category-copy{margin-top:6px;line-height:1.55;max-width:760px}.category-top-actions,.starter-template-actions{display:flex;gap:10px;flex-wrap:wrap}.category-top-actions .button,.starter-all{width:auto;min-width:150px}.category-workflow-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.category-workflow-steps>div{border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:12px;background:rgba(255,255,255,.055);display:flex;gap:10px;align-items:center}.category-workflow-steps strong{display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:rgba(109,255,157,.18);color:#fff}.category-workflow-steps span{font-weight:850;color:var(--text-strong,#fff)}.starter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.starter-template-card{border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:14px;background:rgba(255,255,255,.055);display:grid;gap:10px}.starter-template-title{font-weight:950;color:var(--text-strong,#fff);font-size:16px}.starter-template-helper{line-height:1.45;font-size:13px}.starter-template-actions .button{width:auto;min-width:110px}.ticket-category-shell{display:grid;grid-template-columns:minmax(320px,.95fr) minmax(0,1.35fr);gap:16px}.ticket-category-list-card,.ticket-category-editor-card{border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:14px;background:radial-gradient(circle at top right,rgba(99,213,255,.05),transparent 36%),rgba(255,255,255,.02);min-width:0}.ticket-category-toolbar{margin-bottom:12px}.ticket-category-list{display:grid;gap:10px;max-height:900px;overflow:auto;padding-right:2px}.ticket-category-row{appearance:none;width:100%;text-align:left;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:12px;background:radial-gradient(circle at top right,rgba(255,255,255,.04),transparent 42%),rgba(255,255,255,.02);color:var(--text,#dbe4ee);cursor:pointer}.ticket-category-row:hover{border-color:rgba(99,213,255,.22);background:radial-gradient(circle at top right,rgba(99,213,255,.08),transparent 42%),rgba(255,255,255,.03)}.ticket-category-row.active{border-color:rgba(93,255,141,.28);box-shadow:0 0 0 1px rgba(93,255,141,.12) inset}.ticket-category-row-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}.ticket-category-name-wrap{display:flex;align-items:center;gap:10px;min-width:0}.ticket-category-color{width:12px;height:12px;border-radius:999px;flex-shrink:0;box-shadow:0 0 0 3px rgba(255,255,255,.05)}.ticket-category-name{font-weight:800;overflow-wrap:anywhere}.ticket-category-chip-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ticket-category-meta,.ticket-category-usage-row{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;color:var(--muted,#9fb0c3);font-size:12px;line-height:1.4}.ticket-category-form-grid,.ticket-category-usage-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ticket-color-row{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;align-items:center}.ticket-color-picker{width:52px;height:42px;padding:0;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:transparent}.ticket-check-row{display:flex;align-items:center;gap:10px;min-height:42px}.ticket-category-preset-box,.ticket-category-usage-panel{margin-top:14px;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:12px;background:rgba(255,255,255,.02)}.ticket-preset-title{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#9fb0c3);margin-bottom:10px}.ticket-preset-chip-row{display:flex;gap:8px;flex-wrap:wrap}.ticket-keyword-chip{appearance:none;border:1px solid rgba(99,213,255,.18);background:rgba(99,213,255,.08);color:var(--text,#dbe4ee);border-radius:999px;padding:7px 10px;font-size:12px;cursor:pointer}.ticket-keyword-chip.ghost{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.04)}.ticket-editor-actions{margin-top:16px;display:flex;gap:10px;flex-wrap:wrap}.ticket-editor-footnote{margin-top:14px;color:var(--muted,#9fb0c3);font-size:12px}@media(max-width:1024px){.ticket-category-shell,.category-workflow-steps{grid-template-columns:1fr}}@media(max-width:720px){.ticket-category-form-grid,.ticket-category-usage-grid{grid-template-columns:1fr}.ticket-editor-actions,.category-top-actions,.starter-template-actions{display:grid;grid-template-columns:1fr}.ticket-editor-actions .button,.ticket-editor-actions a,.category-top-actions .button,.starter-template-actions .button,.starter-all{width:100%!important}}
      `}</style>
    </div>
  );
}
