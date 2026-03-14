export type BotCommandStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type BotCommandRow = {
  id: string;
  guild_id: string;
  action: string;
  payload: Record<string, unknown>;
  status: BotCommandStatus;
  result: Record<string, unknown>;
  error: string | null;
  requested_by: string | null;
  created_at: string;
  picked_up_at: string | null;
  completed_at: string | null;
};

export type WaitForBotCommandResult = {
  ok: boolean;
  command: BotCommandRow;
  timedOut: boolean;
};

export type WaitForBotCommandOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  signal?: AbortSignal;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function fetchBotCommand(commandId: string): Promise<BotCommandRow> {
  const id = String(commandId || "").trim();

  if (!id) {
    throw new Error("Missing command id");
  }

  const res = await fetch(`/api/bot-commands/${encodeURIComponent(id)}`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      data?.error || `Failed to fetch bot command (${res.status})`
    );
  }

  if (!data?.ok || !data?.command) {
    throw new Error("Invalid bot command response");
  }

  return data.command as BotCommandRow;
}

export async function waitForBotCommand(
  commandId: string,
  options: WaitForBotCommandOptions = {}
): Promise<WaitForBotCommandResult> {
  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? options.timeoutMs
      : 45_000;

  const intervalMs =
    typeof options.intervalMs === "number" && options.intervalMs > 0
      ? options.intervalMs
      : 1_500;

  const started = Date.now();
  let latest: BotCommandRow | null = null;

  while (Date.now() - started < timeoutMs) {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      latest = await fetchBotCommand(commandId);

      if (latest.status === "completed") {
        return {
          ok: true,
          command: latest,
          timedOut: false,
        };
      }

      if (latest.status === "failed") {
        return {
          ok: false,
          command: latest,
          timedOut: false,
        };
      }

      /**
       * NEW FIX
       * If the command is actively processing,
       * we treat it as success-in-progress rather than failure.
       */
      if (latest.status === "processing") {
        return {
          ok: true,
          command: latest,
          timedOut: false,
        };
      }

    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      /**
       * Ignore temporary network or API failures
       * and continue polling.
       */
    }

    await sleep(intervalMs);
  }

  /**
   * Timeout fallback
   * One final fetch attempt before returning.
   */

  if (!latest) {
    latest = await fetchBotCommand(commandId);
  }

  /**
   * CRITICAL FIX
   * A timeout should NOT be treated as failure
   * if the command is already processing or completed.
   */

  return {
    ok:
      latest.status === "completed" ||
      latest.status === "processing",
    command: latest,
    timedOut: true,
  };
}

export async function queueAndWaitForBotCommand<
  TQueueResponse extends {
    ok?: boolean;
    queued?: boolean;
    command?: { id?: string };
    error?: string;
  }
>(
  queueRequest: Promise<TQueueResponse>,
  options: WaitForBotCommandOptions = {}
): Promise<WaitForBotCommandResult> {

  const queued = await queueRequest;

  if (!queued?.ok || !queued?.queued || !queued?.command?.id) {
    throw new Error(queued?.error || "Failed to queue bot command");
  }

  return waitForBotCommand(queued.command.id, options);
}
