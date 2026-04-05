"use client";

import { useMemo } from "react";

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatWhen(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

function eventTitle(row) {
  return (
    row?.title ||
    row?.event_title ||
    row?.event_type ||
    "Ticket activity"
  );
}

function eventReason(row) {
  return row?.reason || row?.description || row?.summary || "";
}

export default function MemberTicketThreadClient(props) {
  const ticket = props?.ticket || null;
  const messages = normalizeArray(props?.messages);
  const notes = normalizeArray(props?.notes);
  const recentActivity = normalizeArray(props?.recentActivity);

  const orderedActivity = useMemo(() => {
    return [...recentActivity].sort((a, b) => {
      const left = new Date(a?.created_at || a?.timestamp || 0).getTime();
      const right = new Date(b?.created_at || b?.timestamp || 0).getTime();
      return right - left;
    });
  }, [recentActivity]);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Ticket Thread</h2>
            <p className="text-sm text-white/60">
              {ticket?.title || ticket?.channel_name || "Ticket details"}
            </p>
          </div>
          <div className="text-xs text-white/50">
            {messages.length} messages • {notes.length} notes
          </div>
        </div>

        <div className="space-y-3">
          {messages.length ? (
            messages.map((message) => (
              <div
                key={message?.id || `${message?.author_id}-${message?.created_at}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">
                    {message?.author_name || message?.author_id || "Unknown"}
                  </div>
                  <div className="text-xs text-white/45">
                    {formatWhen(message?.created_at)}
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-sm text-white/80">
                  {message?.content || message?.body || ""}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/50">
              No ticket messages found.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-white">Recent Activity</h3>
          <p className="text-sm text-white/60">
            Dashboard-linked ticket events for this member and ticket.
          </p>
        </div>

        <div className="space-y-3">
          {orderedActivity.length ? (
            orderedActivity.map((row) => (
              <div
                key={row?.id || `${row?.event_type}-${row?.created_at}`}
                className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">{eventTitle(row)}</div>
                  <div className="text-xs text-white/45">
                    {formatWhen(row?.created_at || row?.timestamp)}
                  </div>
                </div>
                {eventReason(row) ? (
                  <div className="text-sm text-white/75">{eventReason(row)}</div>
                ) : null}
                <div className="mt-2 text-xs text-white/45">
                  {row?.actor_name || row?.actor_id || "System"}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/50">
              No recent activity has been wired into this ticket view yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
