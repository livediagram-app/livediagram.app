// The shared browser telemetry engine (docs/specs/017-telemetry/telemetry.md), extracted from the
// duplicated emitters in apps/editor and apps/help: three-field
// {category, action, type} events buffered and flushed — batched — to
// liveworkspace's central telemetry service (POST <url>/api/events, named
// 'liveplanner.app'; liveworkspace/docs/telemetry.md) on a short timer and on
// page-hide (via navigator.sendBeacon). Strictly fire-and-forget: every failure is
// swallowed, because telemetry must never affect the host app.
//
// Privacy (docs/specs/017-telemetry/telemetry.md): only the closed-vocabulary {category, action,
// type} ever leaves the browser. NEVER pass user-generated content
// (names, element text, ids, share codes) as `type` — the api worker
// also rejects anything outside the allowed vocabulary, but the rule
// starts at the call sites. No identity is sent.
//
// Each app constructs its emitter with its own build-time `enabled`
// gate (NEXT_PUBLIC_TELEMETRY_ENABLED) and its own `isOptedIn` read of
// the shared docs/specs/007-editor/user-preferences.md preference — the editor caches it behind its
// preference-change events, the help centre reads localStorage
// directly — so the HOW stays app-owned and the plumbing shared. What
// they must not each decide for themselves is WHERE the opt-out is
// stored and which way it defaults; those are below.

import {
  errorNameToken,
  errorPageToken,
  errorTypeToken,
  pageViewPath,
  type TelemetryAction,
  type TelemetryCategory,
} from '@liveplanner/api-schema';
import { TELEMETRY_URL, type TelemetryApp } from '@liveworkspace/telemetry';
import { createTelemetryEngine } from '@liveworkspace/telemetry/emitter';

export { onPageHide } from './page-hide';
export * from './timing';

// Where the editor keeps its per-user preferences (docs/specs/007-editor/user-preferences.md). The help
// centre shares the liveplanner.app origin, so an opt-out made in the
// editor has to be visible here — which means both apps read this exact
// string, and a copy in each is a silent privacy bug waiting to happen:
// version the key in the editor (`:v2`, an ordinary schema migration) and
// the help centre goes on reading the dead `:v1`, finds nothing, and falls
// back to its default of ON for a user who explicitly opted out.
//
// It sits in this package for want of a better shared home — the blob it
// names is broader than telemetry, but api-schema (where the /api/preferences
// DTO would belong) isn't a dependency of apps/help, and telemetry is the
// only field of it the help centre reads. If preferences ever need sharing
// beyond the opt-out, this constant should move with them.
export const USER_PREFERENCES_STORAGE_KEY = 'liveplanner:user-preferences:v1';

/**
 * The docs/specs/007-editor/user-preferences.md opt-out rule applied to the raw stored preferences JSON:
 * telemetry is ON unless `telemetryEnabled` is explicitly `false`. Missing
 * key, unparseable JSON and an absent field all mean on, so a corrupted blob
 * can't silently disable collection — and, more importantly, the one shape
 * that means "off" is spelled the same way in every app.
 */
export function telemetryOptInFromRaw(raw: string | null): boolean {
  if (!raw) return true;
  try {
    return (JSON.parse(raw) as { telemetryEnabled?: boolean }).telemetryEnabled !== false;
  } catch {
    return true;
  }
}

/**
 * The uncached read: pull the preferences blob straight out of localStorage
 * and apply the rule above. For a host with no preference-change plumbing of
 * its own (the help centre). Callers that read this on a hot path should
 * cache it and invalidate on `storage` events, the way the editor does.
 */
export function readTelemetryOptIn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return telemetryOptInFromRaw(window.localStorage.getItem(USER_PREFERENCES_STORAGE_KEY));
  } catch {
    // Private-window / storage-disabled: no stored opt-out to honour.
    return true;
  }
}

export type TelemetryEmitter = {
  track: (category: TelemetryCategory, action: TelemetryAction, type?: string) => void;
};

export function createTelemetryEmitter(opts: {
  // The central service's URL, e.g. 'https://liveworkspace.app/api/telemetry' — events go to
  // `${url}/api/events`.
  url: string;
  // Which app the events are from: the dashboard's filter.
  app: TelemetryApp;
  // Build-time kill switch: false makes track() a permanent no-op.
  enabled: boolean;
  // Per-user opt-out (docs/specs/007-editor/user-preferences.md), consulted on every track() call. The
  // caller owns caching / invalidation if the read is hot.
  isOptedIn: () => boolean;
}): TelemetryEmitter {
  // The batching, retry and page-hide flush are liveworkspace's one engine (@liveworkspace/telemetry
  // emitter.ts); this package only fixes the app and the vocabulary's types.
  const { app, ...engineOpts } = opts;
  const engine = createTelemetryEngine(engineOpts);
  return { track: (category, action, type) => engine.track(app, category, action, type) };
}

/**
 * A track() for a host with no preference plumbing of its own (the help
 * centre, marketing, the dashboard): the emitter is built on first use, and
 * the opt-out is read straight through. Deferring construction means a page
 * that never tracks never builds one.
 */
export function createLazyTrack(opts: {
  url: string;
  app: TelemetryApp;
  enabled: boolean;
}): TelemetryEmitter['track'] {
  let emitter: TelemetryEmitter | null = null;
  return (category, action, type) => {
    emitter ??= createTelemetryEmitter({ ...opts, isOptedIn: readTelemetryOptIn });
    emitter.track(category, action, type);
  };
}

// The app this package's emitters report as.
export const TELEMETRY_APP: TelemetryApp = 'liveplanner.app';

// Next inlines `process.env.NEXT_PUBLIC_*` into every client bundle at build
// time, workspace packages included, so the reads below become literals.
// Declared locally because this package doesn't pull in Node's types.
declare const process: { env: Record<string, string | undefined> };

/** The central service's URL: the build's NEXT_PUBLIC_TELEMETRY_URL (staging, local dev), else production's. */
export function telemetryServiceUrl(): string {
  return process.env.NEXT_PUBLIC_TELEMETRY_URL || TELEMETRY_URL;
}

/**
 * The public sites' one track() (help centre, marketing, the dashboard): a
 * lazy emitter with the shared policy, i.e. the build-time
 * NEXT_PUBLIC_TELEMETRY_ENABLED gate plus the docs/specs/007-editor/user-preferences.md opt-out this origin
 * shares with the editor. Built once here so the three apps can't drift on
 * it, and a module singleton so a page that emits from several places (help's
 * page views, article views and errors) runs one buffer, not several. The
 * editor keeps its own emitter: it caches the opt-out behind its preference
 * events.
 */
export const siteTrack: TelemetryEmitter['track'] = createLazyTrack({
  url: telemetryServiceUrl(),
  app: TELEMETRY_APP,
  enabled: process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true',
});

// ---------------------------------------------------------------------
// Client error tracking (docs/specs/017-telemetry/telemetry.md 'Error' category)
// ---------------------------------------------------------------------
//
// Window-level uncaught exceptions + unhandled promise rejections. The
// type says WHERE and WHAT, from closed vocabularies only:
// `<Kind>.<Page>.<ErrorName>`, e.g. `Uncaught.Project.TypeError`. The page
// is the docs/specs/017-telemetry/page-view-telemetry.md page-view path's first segment (ids already stripped) and
// the error name comes from a fixed list (`Other` / `NonError` otherwise):
// never the message, stack, or URL. A stack's function names would say
// more, but production bundles are minified, so they'd be noise that could
// still leak code shape; the editor's area error boundaries name the part
// of the UI instead (`Render.<Area>.*`).
//
// Capped per distinct type per page load so a render / retry loop that
// throws every frame can't flood the pipeline (the count signal saturates
// at the cap; the dashboard reads presence + order of magnitude, not exact
// storm size), and per-type so one noisy page can't hide another.
// Shared by the editor and the help centre; each passes its own
// policy-wrapped track(). The editor's api-client error reports
// (`Error.Api`) take the same cap through `createPerTypeCap`, because a
// request that fails in a loop floods just as hard as a throw that does.

export const ERROR_EMIT_CAP_PER_TYPE = 10;

// A per-page-load budget of `cap` emits per distinct type: the returned
// function answers whether this `type` may still emit, and counts it when
// it may. One counter per caller, so the uncaught-error path and the api
// error path each get their own budget.
export function createPerTypeCap(cap: number = ERROR_EMIT_CAP_PER_TYPE): (type: string) => boolean {
  const emitted = new Map<string, number>();
  return (type) => {
    const n = emitted.get(type) ?? 0;
    if (n >= cap) return false;
    emitted.set(type, n + 1);
    return true;
  };
}

let errorTrackingInstalled = false;

// Cloudflare's JavaScript Detections snippet, injected by the edge into every page, is refused by Trusted Types by
// design and is not counted as ours (docs/specs/016-platform/trusted-types.md). Its throw is recognisable without
// reading a message out: it comes from an inline script (the event's file is the page itself, where every script of
// ours is a file under `/_next/`) and its refusal names TrustedHTML.
export function isEdgeSnippetRefusal(
  event: Pick<ErrorEvent, 'message' | 'filename'> | undefined,
  pageUrl: string,
): boolean {
  if (!event || typeof event.message !== 'string' || typeof event.filename !== 'string')
    return false;
  const page = (url: string) => url.split('#')[0];
  return event.message.includes('TrustedHTML') && page(event.filename) === page(pageUrl);
}

function currentPageUrl(): string {
  try {
    return String(window.location.href);
  } catch {
    return '';
  }
}

function currentErrorPage(): string | null {
  try {
    return errorPageToken(pageViewPath(window.location.pathname));
  } catch {
    return null;
  }
}

export function installClientErrorTracking(
  track: (category: 'Error', action: 'Client', type: string) => void,
): void {
  if (errorTrackingInstalled || typeof window === 'undefined') return;
  errorTrackingInstalled = true;
  const allow = createPerTypeCap();
  const emit = (kind: 'Uncaught' | 'UnhandledRejection', thrown: unknown) => {
    try {
      const type = errorTypeToken(kind, currentErrorPage(), errorNameToken(thrown));
      if (!allow(type)) return;
      track('Error', 'Client', type);
    } catch {
      // Telemetry must never throw into the host app's error path —
      // doubly so here, where we ARE the error path.
    }
  };
  // Bubble-phase 'error' on window sees uncaught JS exceptions only
  // (resource-load errors don't bubble), which is exactly the scope.
  window.addEventListener('error', (e: ErrorEvent) => {
    if (isEdgeSnippetRefusal(e, currentPageUrl())) return;
    emit('Uncaught', e?.error);
  });
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) =>
    emit('UnhandledRejection', e?.reason),
  );
}
