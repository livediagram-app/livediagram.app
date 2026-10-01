// The document format number on every api response (docs/specs/016-platform/new-version-prompt.md):
// an open editor reads it from traffic it already has, so learning it costs no request.
import { DOCUMENT_FORMAT, DOCUMENT_FORMAT_HEADER } from '@livediagram/api-schema';

export function withDocumentFormat(response: Response): Response {
  // A WebSocket upgrade carries its socket; rebuilding it would drop the socket.
  if (response.status === 101) return response;
  const value = String(DOCUMENT_FORMAT);
  try {
    response.headers.set(DOCUMENT_FORMAT_HEADER, value);
    return response;
  } catch {
    // Immutable headers (a redirect, a proxied fetch): the same response with the header added.
    const headers = new Headers(response.headers);
    headers.set(DOCUMENT_FORMAT_HEADER, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
