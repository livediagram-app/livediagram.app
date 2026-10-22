// Reading the api worker's failures in the browser (docs/specs/015-api/api.md "Errors"), shared by the editor's
// client and the public sites'.

// The worker's `error` token from a failed response body, without disturbing the caller's own `res.json()` (it
// reads a clone). Tolerant of empty or non-JSON bodies (a 503 from a missing binding, a network-level failure):
// null rather than a second error on top of the first.
export async function readErrorCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.clone().json()) as { error?: unknown };
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

// A fetch cancelled on purpose (its AbortController fired: the filters changed, the page went), which callers drop
// silently rather than report as a failure.
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}
