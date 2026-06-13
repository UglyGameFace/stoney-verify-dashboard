type BotApiJson = Record<string, unknown>;

function clean(value: unknown): string {
  return String(value || "").trim();
}

function cleanBaseUrl(value: unknown): string {
  return clean(value).replace(/\/+$/, "");
}

export function botApiBaseUrl(): string {
  return cleanBaseUrl(
    process.env.BOT_API_BASE_URL ||
      process.env.BOT_API_URL ||
      process.env.STRUCTURED_BOT_API_URL ||
      process.env.STONEY_BOT_API_URL ||
      "",
  );
}

export function botApiSharedSecret(): string {
  return clean(
    process.env.BOT_API_SHARED_SECRET ||
      process.env.STONEY_BOT_API_SHARED_SECRET ||
      process.env.BOT_API_KEY ||
      "",
  );
}

export function botApiConfigured(): boolean {
  return Boolean(botApiBaseUrl());
}

export async function callBotApi(pathname: string, payload: BotApiJson, init: RequestInit = {}): Promise<BotApiJson> {
  const baseUrl = botApiBaseUrl();
  if (!baseUrl) {
    throw new Error("BOT_API_BASE_URL or BOT_API_URL is not configured.");
  }

  const secret = botApiSharedSecret();
  const response = await fetch(`${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`, {
    method: init.method || "POST",
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(secret ? { authorization: `Bearer ${secret}`, "x-api-key": secret } : {}),
      ...(init.headers || {}),
    },
    body: init.body ?? JSON.stringify(payload),
  });

  const json = (await response.json().catch(() => null)) as BotApiJson | null;
  if (!response.ok || !json) {
    const message = clean(json?.error) || `Bot API request failed with HTTP ${response.status}`;
    const error = new Error(message) as Error & { status?: number; payload?: BotApiJson | null };
    error.status = response.status;
    error.payload = json;
    throw error;
  }

  return json;
}

export async function readBotOperationJob(jobId: string): Promise<BotApiJson> {
  const baseUrl = botApiBaseUrl();
  if (!baseUrl) {
    throw new Error("BOT_API_BASE_URL or BOT_API_URL is not configured.");
  }
  const secret = botApiSharedSecret();
  const response = await fetch(`${baseUrl}/operations/${encodeURIComponent(jobId)}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(secret ? { authorization: `Bearer ${secret}`, "x-api-key": secret } : {}),
    },
  });
  const json = (await response.json().catch(() => null)) as BotApiJson | null;
  if (!response.ok || !json) {
    const message = clean(json?.error) || `Bot operation lookup failed with HTTP ${response.status}`;
    const error = new Error(message) as Error & { status?: number; payload?: BotApiJson | null };
    error.status = response.status;
    error.payload = json;
    throw error;
  }
  return json;
}
