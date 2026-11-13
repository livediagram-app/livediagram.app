// A request that reports the bytes it has sent (an upload's progress ring): `fetch` gives no upload progress, so
// the api core's funnel (core.ts `apiFetch` with `uploadProgress`) sends such a request by XMLHttpRequest and
// answers the same Response fetch would. It keeps fetch's rules: a failure before any response rejects with a
// TypeError (so the funnel reports it as a network error), an aborted signal rejects with its reason (an
// AbortError), and the response's status, headers and body are as the server sent them.

/** Told the bytes sent so far and the request body's whole size, as the browser sends them. */
export type UploadProgress = (sent: number, total: number) => void;

// Headers the browser sets itself and refuses from script, warning for each; fetch drops them quietly.
const BROWSER_SET = new Set(['content-length', 'host', 'connection']);

// Statuses a Response is built without a body for (the constructor throws on one with a body).
const NULL_BODY = new Set([101, 204, 205, 304]);

export function xhrFetch(
  input: string,
  init: RequestInit | undefined,
  onProgress: UploadProgress,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const signal = init?.signal ?? null;
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open((init?.method ?? 'GET').toUpperCase(), input);
    xhr.responseType = 'arraybuffer';
    // fetch's default (same-origin) sends cookies only to this origin, as XMLHttpRequest does without credentials.
    xhr.withCredentials = init?.credentials === 'include';
    new Headers(init?.headers).forEach((value, name) => {
      if (!BROWSER_SET.has(name)) xhr.setRequestHeader(name, value);
    });
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    const abort = () => xhr.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const settle = (then: () => void) => {
      signal?.removeEventListener('abort', abort);
      then();
    };
    xhr.onload = () =>
      settle(() => {
        // A status of 0 is no response at all (a blocked request): a network failure, as fetch has it.
        if (xhr.status === 0) reject(new TypeError('Failed to fetch'));
        else resolve(responseOf(xhr));
      });
    xhr.onerror = () => settle(() => reject(new TypeError('Failed to fetch')));
    xhr.ontimeout = xhr.onerror;
    xhr.onabort = () => settle(() => reject(abortReason(signal)));
    xhr.send((init?.body ?? null) as XMLHttpRequestBodyInit | null);
  });
}

function abortReason(signal: AbortSignal | null): unknown {
  return signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function responseOf(xhr: XMLHttpRequest): Response {
  const headers = new Headers();
  for (const line of xhr.getAllResponseHeaders().split('\r\n')) {
    const at = line.indexOf(':');
    if (at > 0) headers.append(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  const body = NULL_BODY.has(xhr.status) ? null : (xhr.response as ArrayBuffer | null);
  return new Response(body, { status: xhr.status, statusText: xhr.statusText, headers });
}
