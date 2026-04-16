"use client";

import { useMemo, useState } from "react";
import { createTicketAction } from "@/lib/dashboardActions";

type CategoryOption = {
  value: string;
  label: string;
};

type CreateTicketResult = {
  ok?: boolean;
  command?: {
    error?: string | null;
    result?: {
      created?: boolean;
      duplicate?: boolean;
      existing_ticket?: {
        discord_thread_id?: string;
        title?: string;
      };
      ticket?: {
        channel_name?: string;
        mention?: string;
      };
    };
  };
};

type CreateTicketButtonProps = {
  userId: string;
  currentStaffId?: string | null;
  className?: string;
  onCreated?: () => void | Promise<void>;
  defaultCategory?: string;
  defaultPriority?: string;
  allowDuplicate?: boolean;
  categoryOptions?: CategoryOption[];
  title?: string;
  description?: string;
};

function buttonClass(kind: "primary" | "secondary", disabled = false) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition border";
  const palette =
    kind === "primary"
      ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
      : "bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800";
  const off = disabled ? " opacity-50 cursor-not-allowed hover:bg-inherit" : "";
  return `${base} ${palette}${off}`;
}

function inputClass() {
  return "w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500";
}

function panelClass() {
  return "rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4";
}

function safeText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export default function CreateTicketButton({
  userId,
  currentStaffId,
  className = "",
  onCreated,
  defaultCategory = "support",
  defaultPriority = "medium",
  allowDuplicate = false,
  categoryOptions,
  title = "Create Ticket",
  description = "Open a ticket from the dashboard and have it appear in Discord automatically.",
}: CreateTicketButtonProps) {
  const categories = useMemo<CategoryOption[]>(
    () =>
      categoryOptions && categoryOptions.length > 0
        ? categoryOptions
        : [
            { value: "support", label: "Support" },
            { value: "verification", label: "Verification" },
            { value: "appeal", label: "Appeal" },
            { value: "report", label: "Report" },
          ],
    [categoryOptions]
  );

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState(defaultCategory);
  const [priority, setPriority] = useState(defaultPriority);
  const [openingMessage, setOpeningMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!userId.trim()) {
      setError("Missing user ID.");
      setMessage("");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = (await createTicketAction(
        {
          userId: userId.trim(),
          category,
          priority,
          openingMessage,
          allowDuplicate,
          requestedBy: currentStaffId ?? null,
          staffId: currentStaffId ?? null,
        },
        {
          timeoutMs: 60_000,
          intervalMs: 1_500,
        }
      )) as CreateTicketResult;

      if (!result?.ok) {
        throw new Error(result?.command?.error || "Failed to create ticket.");
      }

      const commandResult = result.command?.result;

      if (commandResult?.duplicate) {
        setMessage("User already has an open ticket.");
      } else if (commandResult?.ticket?.mention) {
        setMessage(`Ticket created: ${commandResult.ticket.mention}`);
      } else if (commandResult?.ticket?.channel_name) {
        setMessage(`Ticket created: #${commandResult.ticket.channel_name}`);
      } else {
        setMessage("Ticket created.");
      }

      setOpen(false);
      setOpeningMessage("");

      if (onCreated) {
        await onCreated();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create ticket.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <button
        type="button"
        className={buttonClass("primary", busy)}
        disabled={busy}
        onClick={() => {
          setError("");
          setMessage("");
          setOpen((v) => !v);
        }}
      >
        {busy ? "Creating..." : title}
      </button>

      {open && (
        <div className={panelClass()}>
          <div className="mb-1 text-sm font-semibold text-white">{title}</div>
          <div className="mb-4 text-xs text-zinc-400">{description}</div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Category
              </label>
              <select
                className={inputClass()}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={busy}
              >
                {categories.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Priority
              </label>
              <select
                className={inputClass()}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={busy}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Opening Message
            </label>
            <textarea
              className={`${inputClass()} min-h-[110px] resize-y`}
              value={openingMessage}
              onChange={(e) => setOpeningMessage(e.target.value)}
              disabled={busy}
              placeholder="Optional opening context for the ticket..."
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass("secondary", busy)}
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={buttonClass("primary", busy)}
              disabled={busy}
              onClick={handleCreate}
            >
              {busy ? "Creating..." : "Confirm Create"}
            </button>
          </div>
        </div>
      )}

      {!!message && (
        <div className="rounded-2xl border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          {safeText(message)}
        </div>
      )}

      {!!error && (
        <div className="rounded-2xl border border-red-800 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {safeText(error)}
        </div>
      )}
    </div>
  );
}
