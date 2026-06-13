"use client";

import { useMemo, useState } from "react";
import {
  buildChannelBuilderDryRun,
  CHANNEL_TEMPLATE_BLOCKS,
  templateBlocksToItems,
  type ChannelBuilderDryRunResult,
  type ChannelBuilderInputItem,
  type ChannelBuilderTemplateBlockId,
  type ChannelBuilderChannelType,
  type ChannelStyleOptions,
} from "@/lib/channel-style";
import ChannelStyleControls from "./ChannelStyleControls";
import StyleWarningBanner from "./StyleWarningBanner";

type ChannelBuilderDryRunClientProps = {
  guildId: string;
};

type BuilderRow = ChannelBuilderInputItem & {
  currentChannelId?: string;
};

type ExistingChannel = {
  id: string;
  name: string;
  type: string;
  category_name?: string | null;
  category_id?: string | null;
};

type QueuedJob = {
  id?: string;
  status?: string;
  operation_type?: string;
  progress_current?: number;
  progress_total?: number;
  result?: unknown;
  error_message?: string | null;
};

type BotPreflight = {
  queueable?: boolean;
  validation_errors?: unknown[];
  preflight?: unknown;
  item_count?: number;
  dryRun?: ChannelBuilderDryRunResult;
};

const DEFAULT_BLOCKS: ChannelBuilderTemplateBlockId[] = ["community_core", "support_core", "safety_staff"];

function buttonClass(kind: "primary" | "secondary" | "danger" = "secondary", disabled = false) {
  const base = "inline-flex min-h-[42px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold transition";
  const palette =
    kind === "primary"
      ? "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700"
      : kind === "danger"
        ? "border-red-500/40 bg-red-950/40 text-red-100 hover:border-red-400"
        : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500";
  return `${base} ${palette} ${disabled ? "cursor-not-allowed opacity-50" : ""}`;
}

function inputClass() {
  return "w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500";
}

function actionBadge(action: string) {
  const cls =
    action === "create"
      ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-100"
      : action === "rename"
        ? "border-amber-500/40 bg-amber-950/40 text-amber-100"
        : action === "conflict"
          ? "border-red-500/40 bg-red-950/40 text-red-100"
          : action === "keep"
            ? "border-sky-500/30 bg-sky-950/30 text-sky-100"
            : "border-zinc-700 bg-zinc-900 text-zinc-300";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{action}</span>;
}

function makeRow(name = "new-channel"): BuilderRow {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    type: "text",
    selected: true,
  };
}

function jobStatusClass(status?: string) {
  const normalized = String(status || "queued").toLowerCase();
  if (["succeeded", "completed"].includes(normalized)) return "border-emerald-500/40 bg-emerald-950/40 text-emerald-100";
  if (["failed", "partial", "partial_failed"].includes(normalized)) return "border-red-500/40 bg-red-950/40 text-red-100";
  if (["running", "queued", "waiting_rate_limit"].includes(normalized)) return "border-amber-500/40 bg-amber-950/40 text-amber-100";
  return "border-zinc-700 bg-zinc-900 text-zinc-200";
}

function preflightStatusClass(preflight: BotPreflight | null) {
  if (!preflight) return "border-zinc-700 bg-zinc-900 text-zinc-200";
  return preflight.queueable
    ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-100"
    : "border-red-500/40 bg-red-950/40 text-red-100";
}

function toBuilderRows(rows: ChannelBuilderInputItem[]): BuilderRow[] {
  return rows.map((row) => ({ ...row }));
}

function discordTypeToBuilderType(type: string): ChannelBuilderChannelType {
  if (type === "voice") return "voice";
  if (type === "forum") return "forum";
  if (type === "news") return "announcement";
  if (type === "category") return "category";
  return "text";
}

function rollbackAvailable(job: QueuedJob | null): boolean {
  const result = job?.result;
  const status = String(job?.status || "").toLowerCase();
  if (!job?.id || job.operation_type !== "channel_builder_apply_plan") return false;
  if (!["succeeded", "partial"].includes(status)) return false;
  if (!result || typeof result !== "object") return false;
  return Boolean((result as { rollback_available?: unknown }).rollback_available);
}

export default function ChannelBuilderDryRunClient({ guildId }: ChannelBuilderDryRunClientProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<ChannelBuilderTemplateBlockId[]>(DEFAULT_BLOCKS);
  const [items, setItems] = useState<BuilderRow[]>(() => toBuilderRows(templateBlocksToItems(DEFAULT_BLOCKS)));
  const [stylePayload, setStylePayload] = useState<{ name: string; options: ChannelStyleOptions }>({
    name: "gaming-clips",
    options: { emoji: "🎮", separator: "・", unicodeStyle: "normal", safetyLevel: "recommended_readability" },
  });
  const [existingChannels, setExistingChannels] = useState<ExistingChannel[]>([]);
  const [apiDryRun, setApiDryRun] = useState<ChannelBuilderDryRunResult | null>(null);
  const [botPreflight, setBotPreflight] = useState<BotPreflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);
  const [pollBusy, setPollBusy] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [queuedJob, setQueuedJob] = useState<QueuedJob | null>(null);

  const localDryRun = useMemo(() => buildChannelBuilderDryRun(items, stylePayload.options), [items, stylePayload.options]);
  const dryRun = apiDryRun || localDryRun;
  const canQueue = dryRun.ok && dryRun.summary.conflict === 0 && (dryRun.summary.create > 0 || dryRun.summary.rename > 0 || dryRun.summary.keep > 0);
  const canSubmitApproved = canQueue && Boolean(botPreflight?.queueable);
  const canUndo = rollbackAvailable(queuedJob);

  function invalidatePlan() {
    setApiDryRun(null);
    setBotPreflight(null);
    setQueuedJob(null);
  }

  function toggleBlock(blockId: ChannelBuilderTemplateBlockId) {
    const next = selectedBlocks.includes(blockId)
      ? selectedBlocks.filter((id) => id !== blockId)
      : [...selectedBlocks, blockId];
    setSelectedBlocks(next);
    setItems(toBuilderRows(templateBlocksToItems(next)));
    invalidatePlan();
  }

  function updateItem(index: number, patch: Partial<BuilderRow>) {
    setItems((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    invalidatePlan();
  }

  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
    invalidatePlan();
  }

  function selectExistingChannel(index: number, channelId: string) {
    const channel = existingChannels.find((row) => row.id === channelId);
    if (!channel) {
      updateItem(index, { currentChannelId: undefined, currentName: undefined });
      return;
    }
    updateItem(index, {
      currentChannelId: channel.id,
      currentName: channel.name,
      type: discordTypeToBuilderType(channel.type),
      category: channel.category_name || undefined,
    });
  }

  async function loadExistingChannels() {
    setScanBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/channel-builder/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to scan existing channels.");
      }
      setExistingChannels(Array.isArray(json.channels) ? json.channels : []);
      setMessage(`Loaded ${Number(json.total || 0)} existing channels. Use the dropdowns for safe restyles by channel ID.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan existing channels.");
    } finally {
      setScanBusy(false);
    }
  }

  async function runServerDryRun() {
    setBusy(true);
    setMessage("");
    setError("");
    setBotPreflight(null);
    try {
      const response = await fetch("/api/channel-builder/dry-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, items, options: stylePayload.options }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Channel Builder dry-run failed.");
      }
      setApiDryRun(json.dryRun);
      setMessage("Server dry-run refreshed. No Discord changes were made. Run bot preflight before queueing the approved job.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Channel Builder dry-run failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runBotPreflight() {
    setPreflightBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/channel-builder/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, items, options: stylePayload.options }),
      });
      const json = await response.json().catch(() => null);
      if (json?.dryRun) setApiDryRun(json.dryRun);
      if (json) {
        setBotPreflight({
          queueable: Boolean(json.queueable),
          validation_errors: Array.isArray(json.validation_errors) ? json.validation_errors : [],
          preflight: json.preflight || null,
          item_count: Number(json.item_count || 0),
          dryRun: json.dryRun,
        });
      }
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Bot preflight failed.");
      }
      setMessage(json.queueable ? "Bot preflight passed. Queue approved job is now unlocked." : "Bot preflight returned issues. Fix them before queueing.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bot preflight failed.");
    } finally {
      setPreflightBusy(false);
    }
  }

  async function submitQueuedJob(dryRunOnly = false) {
    setQueueBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/channel-builder/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, items, options: stylePayload.options, mode: "apply_plan", dryRunOnly }),
      });
      const json = await response.json().catch(() => null);
      if (json?.preflight) {
        setBotPreflight({ queueable: Boolean(json.ok), preflight: json.preflight, dryRun: json.dryRun });
      }
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to queue Channel Builder job.");
      }
      setApiDryRun(json.dryRun || apiDryRun);
      setQueuedJob(json.job || null);
      setMessage(dryRunOnly ? "Queued a bot-side dry-run job. Poll the job to confirm the bot sees the same plan." : "Queued Channel Builder job. Poll status before touching anything else.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue Channel Builder job.");
    } finally {
      setQueueBusy(false);
    }
  }

  async function pollQueuedJob() {
    const jobId = queuedJob?.id;
    if (!jobId) return;
    setPollBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/channel-builder/jobs/${encodeURIComponent(jobId)}`, {
        method: "GET",
        cache: "no-store",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to poll Channel Builder job.");
      }
      setQueuedJob(json.job || null);
      setMessage("Job status refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to poll Channel Builder job.");
    } finally {
      setPollBusy(false);
    }
  }

  async function submitUndoJob() {
    const sourceJobId = queuedJob?.id;
    if (!sourceJobId) return;
    setUndoBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/channel-builder/undo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, sourceJobId }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to queue Channel Builder undo.");
      }
      setQueuedJob(json.job || null);
      setMessage("Queued Channel Builder undo. Poll status to confirm rollback completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue Channel Builder undo.");
    } finally {
      setUndoBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 to-zinc-950 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Channel Builder</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Preview channel creation and restyles safely</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Pick reusable blocks, scan live channels by ID, dry-run the plan, bot-preflight live Discord permissions, then submit approved changes through the bot operation queue.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={scanBusy || queueBusy} onClick={loadExistingChannels} className={buttonClass("secondary", scanBusy || queueBusy)}>
              {scanBusy ? "Scanning..." : "Scan existing channels"}
            </button>
            <button type="button" disabled={busy || queueBusy} onClick={runServerDryRun} className={buttonClass("secondary", busy || queueBusy)}>
              {busy ? "Running dry-run..." : "Run server dry-run"}
            </button>
            <button type="button" disabled={preflightBusy || queueBusy || !canQueue} onClick={runBotPreflight} className={buttonClass("secondary", preflightBusy || queueBusy || !canQueue)}>
              {preflightBusy ? "Checking bot..." : "Run bot preflight"}
            </button>
            <button type="button" disabled={queueBusy || !canQueue} onClick={() => submitQueuedJob(true)} className={buttonClass("secondary", queueBusy || !canQueue)}>
              Queue bot dry-run
            </button>
            <button type="button" disabled={queueBusy || !canSubmitApproved} onClick={() => submitQueuedJob(false)} className={buttonClass("primary", queueBusy || !canSubmitApproved)}>
              {queueBusy ? "Queueing..." : "Queue approved job"}
            </button>
          </div>
        </div>
        {message && <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-100">{message}</div>}
        {error && <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-100">{error}</div>}
        {botPreflight && (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Bot preflight</div>
                <p className="mt-1 text-xs leading-5 text-zinc-400">Live Discord permission and limit check from the bot before queueing.</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${preflightStatusClass(botPreflight)}`}>
                {botPreflight.queueable ? "Queueable" : "Blocked"}
              </span>
            </div>
            {Array.isArray(botPreflight.validation_errors) && botPreflight.validation_errors.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-100">
                {botPreflight.validation_errors.map((item, index) => <div key={index}>{String(item)}</div>)}
              </div>
            ) : null}
            {botPreflight.preflight ? (
              <pre className="mt-3 max-h-44 overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-200">
                {JSON.stringify(botPreflight.preflight, null, 2)}
              </pre>
            ) : null}
          </div>
        )}
        {queuedJob && (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Queued operation</div>
                <div className="mt-1 truncate text-xs text-zinc-400">Job ID: {queuedJob.id || "unknown"}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${jobStatusClass(queuedJob.status)}`}>{queuedJob.status || "queued"}</span>
                <button type="button" disabled={pollBusy || undoBusy} onClick={pollQueuedJob} className={buttonClass("secondary", pollBusy || undoBusy)}>
                  {pollBusy ? "Refreshing..." : "Poll status"}
                </button>
              </div>
            </div>
            {queuedJob.error_message ? <div className="mt-3 text-sm text-red-200">{queuedJob.error_message}</div> : null}
            {canUndo ? (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-amber-100">Rollback available</div>
                    <p className="mt-1 text-xs leading-5 text-amber-100/80">
                      This queues a source-job based undo using the bot's stored rollback plan. It does not trust client-side rollback data.
                    </p>
                  </div>
                  <button type="button" disabled={undoBusy || pollBusy} onClick={submitUndoJob} className={buttonClass("danger", undoBusy || pollBusy)}>
                    {undoBusy ? "Queueing undo..." : "Undo this Channel Builder job"}
                  </button>
                </div>
              </div>
            ) : null}
            {queuedJob.result ? (
              <pre className="mt-3 max-h-56 overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-200">
                {JSON.stringify(queuedJob.result, null, 2)}
              </pre>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Interchangeable channel blocks</div>
            <p className="mt-1 text-xs leading-5 text-zinc-400">Use some, all, or none. Every row remains editable before the real queued job exists.</p>
          </div>
          <button type="button" onClick={() => setItems((rows) => [...rows, makeRow()])} className={buttonClass("secondary")}>Add custom row</button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {CHANNEL_TEMPLATE_BLOCKS.map((block) => {
            const active = selectedBlocks.includes(block.id);
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => toggleBlock(block.id)}
                className={`rounded-2xl border p-3 text-left transition ${active ? "border-emerald-400 bg-emerald-950/40" : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-600"}`}
                aria-pressed={active}
              >
                <div className="text-sm font-semibold text-white">{block.label}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-400">{block.description}</div>
                <div className="mt-2 text-[11px] font-semibold text-zinc-500">{block.items.length} rows</div>
              </button>
            );
          })}
        </div>
      </section>

      <ChannelStyleControls initialName={stylePayload.name} initialOptions={stylePayload.options} onChange={setStylePayload} />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Selected rows</div>
            <p className="mt-1 text-xs leading-5 text-zinc-400">Pick a live channel for safe restyles by ID. Blank existing channels become create actions.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-zinc-300 sm:min-w-[360px]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2">Create<br /><span className="text-emerald-200">{dryRun.summary.create}</span></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2">Rename<br /><span className="text-amber-200">{dryRun.summary.rename}</span></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2">Conflicts<br /><span className="text-red-200">{dryRun.summary.conflict}</span></div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <div key={item.id || index} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="grid gap-3 xl:grid-cols-[42px_1fr_1fr_1fr_140px_90px] xl:items-end">
                <label className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                  <input
                    type="checkbox"
                    checked={item.selected !== false}
                    onChange={(event) => updateItem(index, { selected: event.target.checked })}
                    className="h-4 w-4 accent-emerald-500"
                    aria-label="Select row"
                  />
                </label>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Plain name</label>
                  <input className={inputClass()} value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Live existing channel</label>
                  <select className={inputClass()} value={item.currentChannelId || ""} onChange={(event) => selectExistingChannel(index, event.target.value)}>
                    <option value="">Create new / typed fallback</option>
                    {existingChannels.map((channel) => (
                      <option key={channel.id} value={channel.id}>{channel.category_name ? `${channel.category_name} / ` : ""}#{channel.name} · {channel.type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Current name fallback</label>
                  <input className={inputClass()} value={item.currentName || ""} onChange={(event) => updateItem(index, { currentName: event.target.value, currentChannelId: undefined })} placeholder="optional existing name" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Type</label>
                  <select className={inputClass()} value={item.type || "text"} onChange={(event) => updateItem(index, { type: event.target.value as ChannelBuilderChannelType })}>
                    <option value="text">Text</option>
                    <option value="announcement">Announcement</option>
                    <option value="voice">Voice</option>
                    <option value="forum">Forum</option>
                    <option value="category">Category</option>
                  </select>
                </div>
                <button type="button" onClick={() => removeItem(index)} className={buttonClass("danger")}>Remove</button>
              </div>
              {item.currentChannelId ? <div className="mt-2 text-xs text-emerald-200">Using live channel ID {item.currentChannelId} for this restyle.</div> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Dry-run result</div>
            <p className="mt-1 text-xs leading-5 text-zinc-400">Approved plans now require a live bot preflight before the final queue button unlocks. No direct-fire Discord changes from the dashboard.</p>
          </div>
          <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-200">
            {dryRun.ok ? (botPreflight?.queueable ? "Bot preflight passed" : "Needs bot preflight") : "Needs fixes before queue"}
          </div>
        </div>

        <StyleWarningBanner warnings={dryRun.warnings} className="mt-3" title="Plan warnings" />

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800">
          <div className="hidden grid-cols-[110px_1fr_1fr_1fr] gap-3 border-b border-zinc-800 bg-zinc-900/90 p-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:grid">
            <div>Action</div>
            <div>Current</div>
            <div>Final</div>
            <div>Notes</div>
          </div>
          <div className="divide-y divide-zinc-800">
            {dryRun.items.map((row) => (
              <div key={`${row.id}:${row.index}`} className="grid gap-3 p-3 text-sm lg:grid-cols-[110px_1fr_1fr_1fr] lg:items-start">
                <div>{actionBadge(row.action)}</div>
                <div className="min-w-0 text-zinc-300">
                  <div className="truncate font-semibold text-white">{row.currentName ? `#${row.currentName}` : "—"}</div>
                  <div className="mt-1 text-xs text-zinc-500">{row.type || "text"}{row.category ? ` • ${row.category}` : ""}</div>
                </div>
                <div className="min-w-0">
                  <code className="block truncate rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100">#{row.finalName || "empty"}</code>
                  <div className="mt-1 truncate text-xs text-zinc-500">canonical: {row.canonicalName || "—"}</div>
                </div>
                <div className="space-y-1 text-xs leading-5 text-zinc-400">
                  <div>{row.reason}</div>
                  {row.warnings.slice(0, 2).map((warning) => (
                    <div key={`${row.id}:${warning.code}:${warning.message}`} className={warning.severity === "danger" ? "text-red-200" : warning.severity === "warning" ? "text-amber-200" : "text-zinc-500"}>
                      {warning.message}
                    </div>
                  ))}
                  {row.warnings.length > 2 && <div className="text-zinc-500">+{row.warnings.length - 2} more warnings</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
