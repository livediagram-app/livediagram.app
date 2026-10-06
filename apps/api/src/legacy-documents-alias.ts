// The deprecated `/api/diagrams…` alias (docs/specs/015-api/public-api-and-tokens.md,
// "Deprecated diagram routes"). The container is a document now; external callers written
// against the old names keep working until the sunset date: the request is moved to
// `/api/documents…` with its body's old keys renamed, and the response's keys are renamed
// back, marked `Deprecation` / `Sunset` with a `Link` to the successor.

import { DOCUMENT_CONVERSION_HEADER } from '@livediagram/api-schema';
import { downgradeLinks, upgradeLegacyLinks } from '@livediagram/document';

export const LEGACY_DOCUMENTS_SUNSET = 'Fri, 30 Apr 2027 00:00:00 GMT';

const LEGACY_PREFIX = '/api/diagrams';
const LEGACY_CONVERSION_HEADER = 'X-Diagram-Conversion';
const CURRENT_PREFIX = '/api/documents';

// Wire keys that name the container (packages/api-schema), current → legacy.
const TO_LEGACY: Record<string, string> = {
  document: 'diagram',
  documents: 'diagrams',
  documentId: 'diagramId',
  documentName: 'diagramName',
  documentTeamId: 'diagramTeamId',
  documentOwnerId: 'diagramOwnerId',
};
const TO_CURRENT: Record<string, string> = Object.fromEntries(
  Object.entries(TO_LEGACY).map(([current, legacy]) => [legacy, current]),
);

export function isLegacyDocumentsPath(pathname: string): boolean {
  return pathname === LEGACY_PREFIX || pathname.startsWith(`${LEGACY_PREFIX}/`);
}

export function renameWireKeys(value: unknown, direction: 'toLegacy' | 'toCurrent'): unknown {
  const map = direction === 'toLegacy' ? TO_LEGACY : TO_CURRENT;
  if (Array.isArray(value)) return value.map((v) => renameWireKeys(v, direction));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [map[k] ?? k, renameWireKeys(v, direction)]),
  );
}

function isJson(headers: Headers): boolean {
  return (headers.get('content-type') ?? '').includes('application/json');
}

// Null when the declared body is over `maxBytes`: the caller answers 413 before anything is read,
// as the gate behind it would have.
export async function fromLegacyRequest(
  request: Request,
  maxBytes = Infinity,
): Promise<Request | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const url = new URL(request.url);
  url.pathname = CURRENT_PREFIX + url.pathname.slice(LEGACY_PREFIX.length);
  let body: BodyInit | null = null;
  if (request.body !== null) {
    const text = await request.text();
    // A chunked body declares no length, so the cap is re-checked on what arrived.
    if (text.length > maxBytes) return null;
    body = isJson(request.headers) && text ? upgradeLegacyBody(text) : text;
  }
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  if (typeof body === 'string')
    headers.set('content-length', String(new TextEncoder().encode(body).length));
  const conversion = headers.get(LEGACY_CONVERSION_HEADER);
  if (conversion !== null) {
    headers.delete(LEGACY_CONVERSION_HEADER);
    headers.set(DOCUMENT_CONVERSION_HEADER, conversion);
  }
  return new Request(url.toString(), { method: request.method, headers, body });
}

export async function toLegacyResponse(response: Response): Promise<Response> {
  // A WebSocket upgrade carries its socket on the Response and cannot be rebuilt.
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set('Deprecation', 'true');
  headers.set('Sunset', LEGACY_DOCUMENTS_SUNSET);
  headers.set('Link', `<${CURRENT_PREFIX}>; rel="successor-version"`);
  if (response.body === null || !isJson(response.headers)) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  const text = await response.text();
  const body = text
    ? JSON.stringify(legacyErrorCode(renameWireKeys(downgradeLinks(JSON.parse(text)), 'toLegacy')))
    : text;
  headers.delete('content-length');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

// Error codes that named the container, current → legacy.
const LEGACY_ERROR_CODES: Record<string, string> = { document_trashed: 'diagram_trashed' };

function legacyErrorCode(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const error = (body as { error?: unknown }).error;
  return typeof error === 'string' && LEGACY_ERROR_CODES[error]
    ? { ...body, error: LEGACY_ERROR_CODES[error] }
    : body;
}

// The body in the current shape. Malformed JSON is passed on untouched so the
// route answers its own 400; throwing here escaped the worker's error handling.
function upgradeLegacyBody(text: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  return JSON.stringify(renameWireKeys(upgradeLegacyLinks(parsed), 'toCurrent'));
}
