// The browser side of every product's telemetry (a product's docs/specs/017-telemetry/telemetry.md):
// three-field {category, action, type} events, batched to the liveworkspace telemetry service
// (liveworkspace/docs/specs/008-telemetry/telemetry.md) by its one engine (@liveworkspace/telemetry emitter.ts) on a short
// timer and on page-hide. Strictly fire-and-forget: every failure is swallowed, because telemetry must
// never affect the host app.
//
// What differs between products is not here. Each product's own `@<product>/telemetry-client` binds
// this package once: its app on the central service, the key its preferences are stored under, its
// vocabulary's types, and its error and timing tokens (its api-schema). Everything in this package
// takes those as arguments, so it reads no product's code and works the same in every one.
//
// Privacy: only the closed-vocabulary {category, action, type} ever leaves the browser. NEVER pass
// user-generated content (names, element text, ids, share codes) as `type`. The service also rejects
// anything outside the allowed vocabulary, but the rule starts at the call sites. No identity is sent.
//
// Each app constructs its emitter with its own build-time `enabled` gate
// (NEXT_PUBLIC_TELEMETRY_ENABLED) and its own `isOptedIn` read of the product's user-preferences
// blob: the editor caches it behind its preference-change events, the help centre reads localStorage
// directly. So the HOW stays app-owned and the plumbing shared. What they must not each decide for
// themselves is WHERE the opt-out is stored (the binding's one key) and which way it defaults (below).
//
// Worker-safe: nothing touches window, document or localStorage at module scope, and every browser
// read is typeof-guarded.

import { TELEMETRY_URL, type TelemetryApp } from '@liveworkspace/telemetry';
import { createTelemetryEngine } from '@liveworkspace/telemetry/emitter';

export {
  createClientErrorTracking,
  createPerTypeCap,
  ERROR_EMIT_CAP_PER_TYPE,
  isEdgeSnippetRefusal,
  type ClientErrorTokens,
  type ErrorTrack,
} from './errors';
export { createDailyReturn } from './daily-return';
export { onPageHide } from './page-hide';
export * from './timing';

/**
 * The opt-out rule (a product's docs/specs/007-editor/user-preferences.md) applied to the raw stored
 * preferences JSON: telemetry is ON unless `telemetryEnabled` is explicitly `false`. Missing key,
 * unparseable JSON and an absent field all mean on, so a corrupted blob can't silently disable
 * collection, and the one shape that means "off" is spelled the same way in every app.
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
 * The uncached read: pull the preferences blob stored under `storageKey` straight out of localStorage
 * and apply the rule above. For a host with no preference-change plumbing of its own (the help
 * centre). Callers that read this on a hot path should cache it and invalidate on `storage` events,
 * the way the editor does.
 */
export function readTelemetryOptIn(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return telemetryOptInFromRaw(window.localStorage.getItem(storageKey));
  } catch {
    // Private-window / storage-disabled: no stored opt-out to honour.
    return true;
  }
}

/** A product's track(), typed by its vocabulary's categories and actions. */
export type TelemetryTrack<C extends string = string, A extends string = string> = (
  category: C,
  action: A,
  type?: string,
) => void;

export type TelemetryEmitter<C extends string = string, A extends string = string> = {
  track: TelemetryTrack<C, A>;
};

export function createTelemetryEmitter<C extends string = string, A extends string = string>(opts: {
  // The telemetry service, e.g. 'https://www.liveworkspace.app/api/telemetry': events go to
  // `${url}/events`.
  url: string;
  // Which app the batch counts for on the shared dashboard.
  app: TelemetryApp;
  // Build-time kill switch: false makes track() a permanent no-op.
  enabled: boolean;
  // Per-user opt-out, consulted on every track() call. The caller owns caching / invalidation if
  // the read is hot.
  isOptedIn: () => boolean;
}): TelemetryEmitter<C, A> {
  // The batching, retry and page-hide flush are liveworkspace's one engine (@liveworkspace/telemetry
  // emitter.ts); this only fixes the app and the vocabulary's types.
  const { app, ...engineOpts } = opts;
  const engine = createTelemetryEngine(engineOpts);
  return { track: (category, action, type) => engine.track(app, category, action, type) };
}

/**
 * A track() for a host with no preference plumbing of its own (the help centre, marketing, the
 * dashboard): the emitter is built on first use, and the opt-out stored under `storageKey` is read
 * straight through. Deferring construction means a page that never tracks never builds one.
 */
export function createLazyTrack<C extends string = string, A extends string = string>(opts: {
  url: string;
  app: TelemetryApp;
  enabled: boolean;
  storageKey: string;
}): TelemetryTrack<C, A> {
  const { storageKey, ...emitterOpts } = opts;
  let emitter: TelemetryEmitter<C, A> | null = null;
  return (category, action, type) => {
    emitter ??= createTelemetryEmitter<C, A>({
      ...emitterOpts,
      isOptedIn: () => readTelemetryOptIn(storageKey),
    });
    emitter.track(category, action, type);
  };
}

// Next inlines `process.env.NEXT_PUBLIC_*` into every client bundle at build time, workspace packages
// included, so the reads below become literals. Declared locally because this package doesn't pull in
// Node's types.
declare const process: { env: Record<string, string | undefined> };

/** The service this build sends to: NEXT_PUBLIC_TELEMETRY_URL (local development, staging), else production's. */
export function telemetryServiceUrl(): string {
  return process.env.NEXT_PUBLIC_TELEMETRY_URL || TELEMETRY_URL;
}

/** The build-time gate: NEXT_PUBLIC_TELEMETRY_ENABLED is exactly `true`. */
export function telemetryEnabledByBuild(): boolean {
  return process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true';
}

/**
 * The public sites' one track() (help centre, marketing, community, the dashboard): a lazy emitter
 * with the shared policy, i.e. the build-time gate plus the opt-out the product's origin shares with
 * its editor. A product's binding builds it once, as a module singleton, so a page that emits from
 * several places (help's page views, article views and errors) runs one buffer, not several. The
 * editor keeps its own emitter: it caches the opt-out behind its preference events.
 */
export function createSiteTrack<C extends string = string, A extends string = string>(opts: {
  app: TelemetryApp;
  storageKey: string;
}): TelemetryTrack<C, A> {
  return createLazyTrack<C, A>({
    url: telemetryServiceUrl(),
    app: opts.app,
    enabled: telemetryEnabledByBuild(),
    storageKey: opts.storageKey,
  });
}
