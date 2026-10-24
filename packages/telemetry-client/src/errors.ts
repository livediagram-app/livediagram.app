// Client error tracking (a product's docs/specs/017-telemetry/telemetry.md 'Error' category).
//
// Window-level uncaught exceptions + unhandled promise rejections. The type says WHERE and WHAT, from
// closed vocabularies only: `<Kind>.<Page>.<ErrorName>`, e.g. `Uncaught.Document.TypeError`. The page
// is the page-view path's first segment (ids already stripped) and the error name comes from a fixed
// list (`Other` / `NonError` otherwise): never the message, stack, or URL. A stack's function names
// would say more, but production bundles are minified, so they'd be noise that could still leak code
// shape; the editor's area error boundaries name the part of the UI instead (`Render.<Area>.*`).
//
// The tokens are each product's own (its api-schema knows its pages), so a product's binding hands
// them in once through `createClientErrorTracking`.
//
// Capped per distinct type per page load so a render / retry loop that throws every frame can't flood
// the pipeline (the count signal saturates at the cap; the dashboard reads presence + order of
// magnitude, not exact storm size), and per-type so one noisy page can't hide another. Shared by the
// editor and the help centre; each passes its own policy-wrapped track(). The editor's api-client
// error reports (`Error.Api`) take the same cap through `createPerTypeCap`, because a request that
// fails in a loop floods just as hard as a throw that does.

export const ERROR_EMIT_CAP_PER_TYPE = 10;

// A per-page-load budget of `cap` emits per distinct type: the returned function answers whether this
// `type` may still emit, and counts it when it may. One counter per caller, so the uncaught-error path
// and the api error path each get their own budget.
export function createPerTypeCap(cap: number = ERROR_EMIT_CAP_PER_TYPE): (type: string) => boolean {
  const emitted = new Map<string, number>();
  return (type) => {
    const n = emitted.get(type) ?? 0;
    if (n >= cap) return false;
    emitted.set(type, n + 1);
    return true;
  };
}

// Cloudflare's JavaScript Detections snippet, injected by the edge into every page, is refused by
// Trusted Types by design and is not counted as ours (a product's docs/specs/016-platform/trusted-types.md).
// Its throw is recognisable without reading a message out: it comes from an inline script (the
// event's file is the page itself, where every script of ours is a file under `/_next/`) and its
// refusal names TrustedHTML.
export function isEdgeSnippetRefusal(
  event: Pick<ErrorEvent, 'message' | 'filename'> | undefined,
  pageUrl: string,
): boolean {
  if (!event || typeof event.message !== 'string' || typeof event.filename !== 'string')
    return false;
  const page = (url: string) => url.split('#')[0];
  return event.message.includes('TrustedHTML') && page(event.filename) === page(pageUrl);
}

/** A product's error tokens: its api-schema's functions of the same names. */
export type ClientErrorTokens = {
  pageViewPath: (pathname: string) => string | null;
  errorPageToken: (pagePath: string | null) => string | null;
  errorTypeToken: (...parts: Array<string | null | undefined>) => string;
  errorNameToken: (thrown: unknown) => string;
};

export type ErrorTrack = (category: 'Error', action: 'Client', type: string) => void;

// One page, one install: whichever product's tracker installs first owns the window's listeners.
let errorTrackingInstalled = false;

function currentPageUrl(): string {
  try {
    return String(window.location.href);
  } catch {
    return '';
  }
}

/** A product's installClientErrorTracking(track), bound to its tokens. Installs once per page. */
export function createClientErrorTracking(tokens: ClientErrorTokens): (track: ErrorTrack) => void {
  const currentErrorPage = (): string | null => {
    try {
      return tokens.errorPageToken(tokens.pageViewPath(window.location.pathname));
    } catch {
      return null;
    }
  };

  return (track) => {
    if (errorTrackingInstalled || typeof window === 'undefined') return;
    errorTrackingInstalled = true;
    const allow = createPerTypeCap();
    const emit = (kind: 'Uncaught' | 'UnhandledRejection', thrown: unknown) => {
      try {
        const type = tokens.errorTypeToken(kind, currentErrorPage(), tokens.errorNameToken(thrown));
        if (!allow(type)) return;
        track('Error', 'Client', type);
      } catch {
        // Telemetry must never throw into the host app's error path, doubly so here, where we ARE
        // the error path.
      }
    };
    // Bubble-phase 'error' on window sees uncaught JS exceptions only (resource-load errors don't
    // bubble), which is exactly the scope.
    window.addEventListener('error', (e: ErrorEvent) => {
      if (isEdgeSnippetRefusal(e, currentPageUrl())) return;
      emit('Uncaught', e?.error);
    });
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) =>
      emit('UnhandledRejection', e?.reason),
    );
  };
}
