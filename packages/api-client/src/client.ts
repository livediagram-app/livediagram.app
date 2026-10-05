// The api client the MCP and the CLI share (docs/specs/015-api/blueprints/cli.md "api-client"): one injected
// fetch, the caller's headers, JSON and text answers, and an `ApiError` naming the status and the body's
// error code. A 5xx or a request that never completed is reported through `onFailure`; a 4xx is the
// caller's to handle, never reported.

export type ApiClientOptions = {
  // Where the api answers: `https://livediagram-api/api` over the MCP's binding, the host's api base for the CLI.
  baseUrl: string;
  fetch: (request: Request) => Promise<Response>;
  // Authorization, the client header, a share code when addressed by a link.
  headers: () => Record<string, string>;
  // `Http503`, `Internal`: 5xx answers and requests that never completed.
  onFailure?: (kind: string) => void;
  timeoutMs?: number;
};

export type ApiClient = {
  fetch(path: string, init?: RequestInit): Promise<Response>;
  json<T>(path: string, init?: RequestInit): Promise<T>;
  text(path: string, init?: RequestInit): Promise<{ body: string; etag: string | null }>;
};

// How much of a failing answer's body an error carries.
export const API_ERROR_BODY_MAX = 500;

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;
  // The body's `error`, when it is JSON naming one.
  readonly code: string | null;
  constructor(status: number, body: string) {
    super(`api ${status}: ${body}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = errorCodeOf(body);
  }
}

function errorCodeOf(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    const code: unknown =
      typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'error') : null;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const raw = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    for (const [key, value] of Object.entries(options.headers())) headers.set(key, value);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const signal = options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : init.signal;
    return options.fetch(
      new Request(`${options.baseUrl}${path}`, { ...init, headers, ...(signal ? { signal } : {}) }),
    );
  };
  const ok = async (path: string, init?: RequestInit) => {
    let res: Response;
    try {
      res = await raw(path, init);
    } catch (err) {
      options.onFailure?.('Internal');
      throw err;
    }
    if (!res.ok) {
      if (res.status >= 500) options.onFailure?.(`Http${res.status}`);
      const body = await res.text().catch(() => '');
      throw new ApiError(res.status, body.slice(0, API_ERROR_BODY_MAX));
    }
    return res;
  };
  return {
    fetch: raw,
    json: async <T>(path: string, init?: RequestInit) => (await (await ok(path, init)).json()) as T,
    text: async (path, init) => {
      const res = await ok(path, init);
      return { body: await res.text(), etag: res.headers.get('ETag') };
    },
  };
}

// Anonymous telemetry to the api's public `/api/events`: no Authorization, never throws into the caller.
export async function postEvents(
  baseUrl: string,
  fetch: ApiClientOptions['fetch'],
  events: readonly { category: string; action: string; type: string }[],
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  try {
    await fetch(
      new Request(`${baseUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify({ events }),
      }),
    );
  } catch {
    // Telemetry never fails a command or a tool.
  }
}
