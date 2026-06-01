"use client";

import { useEffect, useMemo, useState } from "react";

type TicketFormQuestion = {
  key?: string | null;
  label?: string | null;
  placeholder?: string | null;
  required?: boolean | null;
  style?: string | null;
  max_length?: number | null;
};

type TicketCategory = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  color?: string | null;
  intake_type?: string | null;
  description?: string | null;
  form_enabled?: boolean | null;
  form_questions?: TicketFormQuestion[] | null;
  form_config?: Record<string, unknown> | null;
  form_question_count?: number | null;
};

type CategoriesResponse = {
  categories?: TicketCategory[];
  error?: string;
};

type QuestionState = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  style: "short" | "paragraph";
  max_length: string;
};

const EMPTY_QUESTION: QuestionState = {
  key: "",
  label: "",
  placeholder: "",
  required: true,
  style: "paragraph",
  max_length: "700",
};

const TEMPLATE_QUESTIONS: Record<string, QuestionState[]> = {
  support: [
    {
      key: "summary",
      label: "What do you need help with?",
      placeholder: "Explain the issue clearly.",
      required: true,
      style: "paragraph",
      max_length: "1000",
    },
    {
      key: "proof",
      label: "Any screenshots or proof?",
      placeholder: "Paste links or say none.",
      required: false,
      style: "paragraph",
      max_length: "1000",
    },
  ],
  verification: [
    {
      key: "verification_issue",
      label: "What verification problem happened?",
      placeholder: "Could not submit, waiting on staff, VC issue, wrong role, etc.",
      required: true,
      style: "paragraph",
      max_length: "1000",
    },
    {
      key: "username_context",
      label: "What name should staff look for?",
      placeholder: "Discord name, server nickname, or previous name if relevant.",
      required: false,
      style: "short",
      max_length: "200",
    },
  ],
  report: [
    {
      key: "reported_user",
      label: "Who are you reporting?",
      placeholder: "Mention, username, or user ID if you have it.",
      required: true,
      style: "short",
      max_length: "200",
    },
    {
      key: "what_happened",
      label: "What happened?",
      placeholder: "Explain the scam, abuse, spam, raid, or rule break.",
      required: true,
      style: "paragraph",
      max_length: "1200",
    },
    {
      key: "evidence",
      label: "Evidence / message links",
      placeholder: "Paste message links, screenshots, or say none.",
      required: false,
      style: "paragraph",
      max_length: "1000",
    },
  ],
  appeal: [
    {
      key: "action_appealed",
      label: "What are you appealing?",
      placeholder: "Ban, timeout, mute, role removal, etc.",
      required: true,
      style: "short",
      max_length: "200",
    },
    {
      key: "why_review",
      label: "Why should staff review it?",
      placeholder: "Explain what happened and why you believe it should be changed.",
      required: true,
      style: "paragraph",
      max_length: "1200",
    },
  ],
  cod: [
    {
      key: "game",
      label: "Which COD game?",
      placeholder: "Example: BO2, BO3, MW2, MW3, Ghosts, etc.",
      required: true,
      style: "short",
      max_length: "120",
    },
    {
      key: "service",
      label: "What do you need done?",
      placeholder: "Rank, unlocks, modded lobby info, recovery question, etc.",
      required: true,
      style: "paragraph",
      max_length: "1000",
    },
    {
      key: "platform",
      label: "Platform / console",
      placeholder: "Xbox, PlayStation, PC, etc.",
      required: true,
      style: "short",
      max_length: "120",
    },
    {
      key: "availability",
      label: "Best time to reach you?",
      placeholder: "Timezone and when you are usually available.",
      required: false,
      style: "short",
      max_length: "200",
    },
  ],
};

const TEMPLATE_LABELS: Record<string, string> = {
  support: "Support",
  verification: "Verification",
  report: "Report",
  appeal: "Appeal",
  cod: "COD / Service",
};

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
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function questionFromApi(question: TicketFormQuestion): QuestionState {
  const style = normalizeLower(question.style) === "short" ? "short" : "paragraph";
  return {
    key: normalizeString(question.key),
    label: normalizeString(question.label),
    placeholder: normalizeString(question.placeholder),
    required: question.required !== false,
    style,
    max_length: String(question.max_length || (style === "short" ? 200 : 700)),
  };
}

function questionToApi(question: QuestionState): TicketFormQuestion | null {
  const label = normalizeString(question.label).slice(0, 45);
  if (!label) return null;
  const style = question.style === "short" ? "short" : "paragraph";
  const maxLength = Number(question.max_length || (style === "short" ? 200 : 700));
  return {
    key: slugify(question.key || label),
    label,
    placeholder: normalizeString(question.placeholder).slice(0, 100),
    required: Boolean(question.required),
    style,
    max_length: Number.isFinite(maxLength)
      ? Math.max(50, Math.min(Math.round(maxLength), 4000))
      : style === "short"
        ? 200
        : 700,
  };
}

function templateKey(category: TicketCategory | null): string {
  const haystack = [category?.slug, category?.name, category?.intake_type, category?.description]
    .map(normalizeLower)
    .join(" ");
  if (/(cod|call of duty|bo2|bo3|mw2|mw3|modded|lobby)/.test(haystack)) return "cod";
  if (/verify|verification/.test(haystack)) return "verification";
  if (/appeal|ban|mute|timeout/.test(haystack)) return "appeal";
  if (/report|scam|abuse|raid/.test(haystack)) return "report";
  return "support";
}

function formConfig(category: TicketCategory | null): Record<string, unknown> {
  const config = category?.form_config;
  return config && typeof config === "object" && !Array.isArray(config) ? config : {};
}

function cloneQuestions(key: string): QuestionState[] {
  return (TEMPLATE_QUESTIONS[key] || TEMPLATE_QUESTIONS.support).map((question) => ({ ...question }));
}

function questionStatusLabel(category: TicketCategory): string {
  const disabled = category.form_enabled === false || Boolean(formConfig(category).forms_disabled);
  if (disabled) return "Form off";
  const count = Number(category.form_question_count || category.form_questions?.length || 0);
  return count ? `${count} custom` : "Smart default";
}

function questionStatusClass(category: TicketCategory): string {
  const disabled = category.form_enabled === false || Boolean(formConfig(category).forms_disabled);
  if (disabled) return "off";
  const count = Number(category.form_question_count || category.form_questions?.length || 0);
  return count ? "custom" : "smart";
}

export default function TicketFormsManager() {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [disableDefaultTemplate, setDisableDefaultTemplate] = useState(false);
  const [questions, setQuestions] = useState<QuestionState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedCategory = useMemo(
    () => categories.find((category) => normalizeString(category.id) === selectedId) || null,
    [categories, selectedId]
  );

  const selectedTemplateKey = useMemo(() => templateKey(selectedCategory), [selectedCategory]);
  const smartTemplateQuestions = useMemo(() => cloneQuestions(selectedTemplateKey), [selectedTemplateKey]);
  const effectiveQuestions = useMemo(() => {
    if (!selectedCategory) return [];
    if (questions.length) return questions;
    if (disableDefaultTemplate) return [];
    return smartTemplateQuestions;
  }, [selectedCategory, questions, disableDefaultTemplate, smartTemplateQuestions]);

  const customReadyCount = useMemo(
    () => categories.filter((category) => Number(category.form_question_count || category.form_questions?.length || 0) > 0).length,
    [categories]
  );

  const smartDefaultCount = useMemo(
    () => categories.filter((category) => category.form_enabled !== false && !Number(category.form_question_count || category.form_questions?.length || 0)).length,
    [categories]
  );

  async function loadCategories() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ticket-categories", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = (await res.json().catch(() => null)) as CategoriesResponse | null;
      if (!res.ok || json?.error) throw new Error(json?.error || "Failed to load categories.");
      const next = safeArray<TicketCategory>(json?.categories || []);
      setCategories(next);
      if (!selectedId && next[0]?.id) setSelectedId(normalizeString(next[0].id));
      if (selectedId && !next.some((category) => normalizeString(category.id) === selectedId) && next[0]?.id) {
        setSelectedId(normalizeString(next[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    const category = selectedCategory;
    if (!category) {
      setQuestions([]);
      setFormEnabled(true);
      setDisableDefaultTemplate(false);
      return;
    }

    const config = formConfig(category);
    const savedQuestions = safeArray<TicketFormQuestion>(category.form_questions).map(questionFromApi);
    setQuestions(savedQuestions);
    setFormEnabled(category.form_enabled !== false);
    setDisableDefaultTemplate(Boolean(config.disable_default_template || config.forms_disabled));
    setError("");
    setMessage("");
  }, [selectedId, selectedCategory]);

  function updateQuestion(index: number, patch: Partial<QuestionState>) {
    setQuestions((prev) => prev.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  }

  function addQuestion() {
    setQuestions((prev) => {
      if (prev.length >= 5) return prev;
      return [
        ...prev,
        {
          ...EMPTY_QUESTION,
          key: `question_${prev.length + 1}`,
          label: `Question ${prev.length + 1}`,
        },
      ];
    });
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function loadTemplate(key = selectedTemplateKey) {
    if (!selectedCategory) return;
    setQuestions(cloneQuestions(key));
    setDisableDefaultTemplate(false);
    setFormEnabled(true);
    setMessage(`${TEMPLATE_LABELS[key] || "Smart"} template loaded. Save it to make it custom for this category.`);
  }

  function clearCustomQuestions() {
    setQuestions([]);
    setDisableDefaultTemplate(false);
    setFormEnabled(true);
    setMessage("Custom questions cleared locally. Save to return this category to smart defaults.");
  }

  async function handleSave() {
    if (!selectedCategory?.id) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const apiQuestions = questions.map(questionToApi).filter(Boolean) as TicketFormQuestion[];
      const config = {
        ...formConfig(selectedCategory),
        disable_default_template: disableDefaultTemplate,
        forms_disabled: !formEnabled,
      };

      const res = await fetch("/api/ticket-categories", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          id: selectedCategory.id,
          name: selectedCategory.name,
          slug: selectedCategory.slug,
          color: selectedCategory.color || "#45d483",
          description: selectedCategory.description,
          intake_type: selectedCategory.intake_type,
          match_keywords: selectedCategory["match_keywords" as keyof TicketCategory] || [],
          button_label: selectedCategory["button_label" as keyof TicketCategory] || "",
          sort_order: selectedCategory["sort_order" as keyof TicketCategory] || "",
          is_default: Boolean(selectedCategory["is_default" as keyof TicketCategory]),
          form_enabled: formEnabled,
          form_questions: apiQuestions,
          form_config: config,
        }),
      });

      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok || json?.error) throw new Error(json?.error || "Failed to save form settings.");
      setMessage("Ticket form settings saved.");
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save form settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space">
      <div className="card form-workflow-card">
        <div className="form-workflow-head">
          <div>
            <div className="muted form-eyebrow">Step 3 of 3</div>
            <h2 style={{ margin: 0 }}>Ticket Forms</h2>
            <div className="muted form-copy">
              Control what members answer after they choose a ticket category. Smart defaults keep setup fast; custom questions make categories more precise.
            </div>
          </div>
          <div className="form-top-actions">
            <button className="button ghost" type="button" onClick={() => void loadCategories()} disabled={loading || saving}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <a className="button ghost" href="/ticket-categories">Back to Categories</a>
            <a className="button primary" href="/">Open Dashboard</a>
          </div>
        </div>

        <div className="form-status-strip">
          <div><span>Categories</span><strong>{categories.length}</strong></div>
          <div><span>Custom Forms</span><strong>{customReadyCount}</strong></div>
          <div><span>Smart Defaults</span><strong>{smartDefaultCount}</strong></div>
        </div>

        {error ? <div className="error-banner" style={{ marginTop: 12 }}>{error}</div> : null}
        {message ? <div className="info-banner" style={{ marginTop: 12 }}>{message}</div> : null}
      </div>

      {!loading && categories.length === 0 ? (
        <div className="card empty-form-state">
          <div>
            <div className="muted form-eyebrow">Categories Needed</div>
            <h2 style={{ margin: "0 0 8px" }}>Create ticket categories first</h2>
            <div className="muted form-copy">
              Forms attach to categories. Create your Support, Verification, Appeals, or COD categories first, then return here to tune questions.
            </div>
          </div>
          <a className="button primary" href="/ticket-categories">Create Categories</a>
        </div>
      ) : null}

      {categories.length ? (
        <div className="ticket-form-shell">
          <div className="card form-category-card">
            <div className="ticket-preset-title">Issue Types</div>
            <div className="ticket-form-category-list">
              {categories.map((category) => {
                const id = normalizeString(category.id);
                const selected = selectedId === id;
                return (
                  <button key={id || normalizeString(category.slug)} type="button" className={`ticket-form-category ${selected ? "active" : ""}`} onClick={() => setSelectedId(id)}>
                    <div className="form-category-row-head">
                      <span className="form-category-dot" style={{ background: normalizeString(category.color) || "#45d483" }} />
                      <span style={{ fontWeight: 900 }}>{normalizeString(category.name) || "Unnamed"}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {normalizeString(category.slug) || "no-slug"}
                    </div>
                    <div className={`form-status-pill ${questionStatusClass(category)}`}>{questionStatusLabel(category)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card form-editor-card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Editing</div>
                <h3 style={{ margin: "6px 0 0" }}>{selectedCategory?.name || "Select a category"}</h3>
                {selectedCategory ? (
                  <div className="muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
                    Recommended template: <strong>{TEMPLATE_LABELS[selectedTemplateKey] || "Support"}</strong>
                  </div>
                ) : null}
              </div>
              <button type="button" className="button ghost" onClick={() => loadTemplate()} disabled={!selectedCategory || saving} style={{ width: "auto" }}>
                Load Smart Template
              </button>
            </div>

            <div className="template-chip-row">
              {Object.keys(TEMPLATE_QUESTIONS).map((key) => (
                <button key={key} type="button" className={`ticket-keyword-chip ${key === selectedTemplateKey ? "active" : "ghost"}`} onClick={() => loadTemplate(key)} disabled={!selectedCategory || saving}>
                  {TEMPLATE_LABELS[key] || key}
                </button>
              ))}
            </div>

            <div className="ticket-form-controls">
              <label className="ticket-check-row">
                <input type="checkbox" checked={formEnabled} onChange={(e) => setFormEnabled(e.target.checked)} />
                <span>Enable form for this issue type</span>
              </label>
              <label className="ticket-check-row">
                <input type="checkbox" checked={disableDefaultTemplate} onChange={(e) => setDisableDefaultTemplate(e.target.checked)} />
                <span>Disable built-in smart template when no custom questions are saved</span>
              </label>
            </div>

            {!questions.length && effectiveQuestions.length ? (
              <div className="smart-preview-box">
                <div className="ticket-preset-title">Smart Template Preview</div>
                <div className="smart-preview-list">
                  {effectiveQuestions.map((question, index) => (
                    <div key={`${question.key}-${index}`} className="smart-preview-question">
                      <strong>{index + 1}. {question.label}</strong>
                      <span>{question.required ? "Required" : "Optional"} • {question.style === "short" ? "Short answer" : "Paragraph"}</span>
                    </div>
                  ))}
                </div>
                <div className="muted" style={{ marginTop: 10, lineHeight: 1.45 }}>
                  This template is used automatically until you save custom questions. Hit “Load Smart Template” if you want to edit it.
                </div>
              </div>
            ) : null}

            <div className="ticket-form-question-list">
              {questions.length ? (
                questions.map((question, index) => (
                  <div className="ticket-form-question" key={`${index}-${question.key}`}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong>Question {index + 1}</strong>
                      <button type="button" className="ticket-keyword-chip ghost" onClick={() => removeQuestion(index)}>
                        Remove
                      </button>
                    </div>
                    <div className="ticket-form-grid">
                      <label>
                        <span className="ticket-info-label">Label</span>
                        <input className="input" value={question.label} onChange={(e) => updateQuestion(index, { label: e.target.value })} maxLength={45} />
                      </label>
                      <label>
                        <span className="ticket-info-label">Key</span>
                        <input className="input" value={question.key} onChange={(e) => updateQuestion(index, { key: slugify(e.target.value) })} />
                      </label>
                      <label className="full">
                        <span className="ticket-info-label">Placeholder</span>
                        <input className="input" value={question.placeholder} onChange={(e) => updateQuestion(index, { placeholder: e.target.value })} maxLength={100} />
                      </label>
                      <label>
                        <span className="ticket-info-label">Style</span>
                        <select className="input" value={question.style} onChange={(e) => updateQuestion(index, { style: e.target.value === "short" ? "short" : "paragraph" })}>
                          <option value="paragraph">Paragraph</option>
                          <option value="short">Short answer</option>
                        </select>
                      </label>
                      <label>
                        <span className="ticket-info-label">Max Length</span>
                        <input className="input" value={question.max_length} onChange={(e) => updateQuestion(index, { max_length: e.target.value })} />
                      </label>
                      <label className="ticket-check-row full">
                        <input type="checkbox" checked={question.required} onChange={(e) => updateQuestion(index, { required: e.target.checked })} />
                        <span>Required</span>
                      </label>
                    </div>
                  </div>
                ))
              ) : !effectiveQuestions.length ? (
                <div className="empty-state">No custom questions or smart template enabled. Members will open this ticket without extra questions.</div>
              ) : null}
            </div>

            <div className="ticket-editor-actions">
              <button type="button" className="button ghost" onClick={addQuestion} disabled={questions.length >= 5 || saving} style={{ width: "auto" }}>
                Add Question
              </button>
              {questions.length ? (
                <button type="button" className="button ghost" onClick={clearCustomQuestions} disabled={saving} style={{ width: "auto" }}>
                  Use Smart Default
                </button>
              ) : null}
              <button type="button" className="button primary" onClick={() => void handleSave()} disabled={!selectedCategory || saving} style={{ width: "auto", minWidth: 160 }}>
                {saving ? "Saving..." : "Save Form"}
              </button>
            </div>

            <div className="ticket-editor-footnote">
              Discord forms support up to 5 questions. Smart defaults keep setup fast; custom questions override smart defaults.
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .form-workflow-card,.empty-form-state{display:grid;gap:14px}.form-workflow-head,.empty-form-state{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}.form-eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:950;margin-bottom:8px}.form-copy{margin-top:6px;line-height:1.55;max-width:800px}.form-top-actions{display:flex;gap:10px;flex-wrap:wrap}.form-top-actions .button,.empty-form-state .button{width:auto;min-width:150px}.form-status-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.form-status-strip>div{border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:12px;background:rgba(255,255,255,.055)}.form-status-strip span{display:block;color:var(--muted,#c7ddcf);font-size:12px;margin-bottom:4px}.form-status-strip strong{color:var(--text-strong,#fff);font-size:20px}.ticket-form-shell{display:grid;grid-template-columns:minmax(300px,.8fr) minmax(0,1.4fr);gap:16px}.ticket-form-category-list,.ticket-form-question-list,.smart-preview-list{display:grid;gap:10px}.ticket-form-category,.ticket-form-question,.smart-preview-box{width:100%;text-align:left;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:12px;background:rgba(255,255,255,.055);color:var(--text,#dbe4ee)}.ticket-form-category{cursor:pointer;display:grid;gap:6px}.ticket-form-category.active{border-color:rgba(93,255,141,.42);box-shadow:0 0 0 1px rgba(93,255,141,.16) inset,0 0 22px rgba(93,255,141,.08)}.form-category-row-head{display:flex;align-items:center;gap:9px;min-width:0}.form-category-dot{width:11px;height:11px;border-radius:999px;flex-shrink:0}.form-status-pill{justify-self:start;border-radius:999px;padding:6px 9px;font-size:12px;font-weight:900;border:1px solid rgba(255,255,255,.14)}.form-status-pill.smart{background:rgba(120,221,255,.13);border-color:rgba(120,221,255,.26)}.form-status-pill.custom{background:rgba(109,255,157,.13);border-color:rgba(109,255,157,.28)}.form-status-pill.off{background:rgba(255,111,142,.14);border-color:rgba(255,111,142,.28)}.template-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ticket-form-controls{display:grid;gap:10px;margin:16px 0;padding:12px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(255,255,255,.055)}.smart-preview-box{margin-bottom:14px}.smart-preview-question{display:grid;gap:4px;border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:10px;background:rgba(0,0,0,.12)}.smart-preview-question strong{color:var(--text-strong,#fff)}.smart-preview-question span{color:var(--muted,#c7ddcf);font-size:12px}.ticket-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.full{grid-column:1/-1}.ticket-preset-title{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#c7ddcf);margin-bottom:10px}.ticket-check-row{display:flex;align-items:center;gap:10px}.ticket-editor-actions{margin-top:16px;display:flex;gap:10px;flex-wrap:wrap}.ticket-editor-footnote{margin-top:14px;color:var(--muted,#c7ddcf);font-size:12px}.ticket-keyword-chip.active{border-color:rgba(109,255,157,.38);background:rgba(109,255,157,.16)}@media(max-width:1024px){.ticket-form-shell,.form-status-strip{grid-template-columns:1fr}}@media(max-width:720px){.ticket-form-grid{grid-template-columns:1fr}.form-top-actions,.ticket-editor-actions{display:grid;grid-template-columns:1fr}.form-top-actions .button,.ticket-editor-actions .button,.empty-form-state .button{width:100%!important}}
      `}</style>
    </div>
  );
}
