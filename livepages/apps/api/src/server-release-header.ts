// The server release signal on every api response (docs/specs/016-platform/new-version-prompt.md,
// docs/specs/016-platform/stale-builds.md): the document format number, and the live build id when
// the deploy set one. An open editor reads both from traffic it already has, at no request.
import {
  BUILD_ID_HEADER,
  DOCUMENT_FORMAT,
  DOCUMENT_FORMAT_HEADER,
  parseBuildId,
} from '@livediagram/api-schema';

export function withServerRelease(
  response: Response,
  buildId: string | null | undefined,
): Response {
  // A WebSocket upgrade carries its socket; rebuilding it would drop the socket.
  if (response.status === 101) return response;
  const build = parseBuildId(buildId);
  const stamp = (headers: Headers) => {
    headers.set(DOCUMENT_FORMAT_HEADER, String(DOCUMENT_FORMAT));
    if (build) headers.set(BUILD_ID_HEADER, build);
  };
  try {
    stamp(response.headers);
    return response;
  } catch {
    // Immutable headers (a redirect, a proxied fetch): the same response with the headers added.
    const headers = new Headers(response.headers);
    stamp(headers);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
