// How a Worker answers a request that threw (liveworkspace/docs/specs/002-architecture/architecture.md "When a request
// fails"): its storage failing on its own side is a retryable 503, anything else a 500. Neither body echoes the
// error's text, which can name tables.

// Seconds a caller waits before retrying a request a service could not serve: storage, or accounts out of reach.
export const UNAVAILABLE_RETRY_AFTER_SECONDS = 5;

// The storage that failed: a D1 database, or a Durable Object (its SQLite storage or the object itself).
export type StorageOutage = 'd1' | 'durable-object';

// D1's own failures (https://developers.cloudflare.com/d1/observability/debug-d1/#error-list): the database, not the
// query, is at fault, so the same call succeeds once it recovers. A constraint, type or SQL error is a bug and is
// never matched here.
const D1_UNAVAILABLE =
  /^D1_ERROR: (?:internal error|network connection lost|d1 db is overloaded|cannot resolve d1 db due to transient issue|d1 db storage operation exceeded timeout|internal error while starting up d1 db storage|d1 db reset because its code was updated)/i;

// A Durable Object's infrastructure marks its own failures `retryable` (transient) or `overloaded`
// (https://developers.cloudflare.com/durable-objects/best-practices/error-handling/). An error the object's own code
// threw carries neither, so it stays a 500.
function isDurableObjectOutage(err: Error): boolean {
  const flags = err as Error & { retryable?: unknown; overloaded?: unknown };
  return flags.retryable === true || flags.overloaded === true;
}

export function storageOutageOf(err: unknown): StorageOutage | null {
  if (!(err instanceof Error)) return null;
  if (D1_UNAVAILABLE.test(err.message)) return 'd1';
  if (isDurableObjectOutage(err)) return 'durable-object';
  return null;
}

export type RequestFailureAnswer = {
  // The route the Worker was serving, in route words only (`Get.Documents`), never an id.
  route: string;
  // The Worker's own JSON answer, so the failure carries the same CORS and caching headers as any other.
  json: (body: unknown, init?: ResponseInit) => Response;
  // Counts a 500 where the Worker reports its crashes (each product's `Error·Api·Internal.<Route>`). Off the response's
  // critical path: it schedules the report, it never awaits it.
  reportCrash?: () => void;
};

export function failedRequestResponse(err: unknown, answer: RequestFailureAnswer): Response {
  const outage = storageOutageOf(err);
  if (outage) {
    console.error(`[${outage}] unavailable route=${answer.route}`, err);
    return answer.json(
      { error: 'storage_unavailable' },
      { status: 503, headers: { 'Retry-After': String(UNAVAILABLE_RETRY_AFTER_SECONDS) } },
    );
  }
  console.error(`api error route=${answer.route}`, err);
  try {
    answer.reportCrash?.();
  } catch (reportErr) {
    // The 500 must still go out.
    console.error('[telemetry] crash report failed', reportErr);
  }
  return answer.json({ error: 'internal_error' }, { status: 500 });
}

// One guard for a whole request, identity resolution included: nothing that throws is left to the runtime's bare
// error page. `answer` is only built when the request threw.
export async function guardRequest(
  run: () => Promise<Response>,
  answer: () => RequestFailureAnswer,
): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    return failedRequestResponse(err, answer());
  }
}
