// All Apps' pieces of the one help centre's chrome (liveworkspace/docs/specs/016-help/blueprints/help-centre.md "The
// build"), re-exported for the `all` build by lib/bindings.generated.ts: liveworkspace.app's own appearance key and
// slate, the platform's social card, and telemetry sent as liveworkspace.app (packages/telemetry platform-events.ts
// accepts the help events from it). No page-view or web-vitals boots: the platform's ingest takes neither from here.
import type { Viewport } from 'next';
import { brandMarkSvg } from '@liveworkspace/brand/svg';
import {
  createHelpTelemetryIds,
  HELP_TELEMETRY_OVERRIDES,
} from '@liveworkspace/help-registry/telemetry';
import { PLATFORM_TELEMETRY_APP } from '@liveworkspace/telemetry';
import { createTelemetryEngine } from '@liveworkspace/telemetry/emitter';
import { telemetryEnabledByBuild, telemetryServiceUrl } from '@liveworkspace/telemetry-client';
import { trustedConstant } from '@liveworkspace/trusted-types';
import { appearanceBootScript } from '@liveworkspace/ui/appearance-storage';
export { PageNotFound } from '@liveworkspace/ui';
import { createSocialCard } from '@liveworkspace/ui/social-card';

// liveworkspace.app's Appearance key, the one the header's toggle writes (editions/all/lib/appearance-store.ts).
import { PLATFORM_APPEARANCE_KEY } from '../../editions/all/lib/appearance-store';
export const APPEARANCE_BOOT_SCRIPT = trustedConstant(
  appearanceBootScript(PLATFORM_APPEARANCE_KEY),
);

export const PUBLIC_VIEWPORT: Viewport = { themeColor: '#64748b', colorScheme: 'light dark' };

export function PageViewBoot() {
  return null;
}
export function WebVitalsBoot() {
  return null;
}

export const renderSocialCard = /* @__PURE__ */ createSocialCard({
  markSvg: brandMarkSvg({ app: 'livediagram', variant: 'full', scheme: 'light' }),
  wordmark: 'workspace',
  domain: 'liveworkspace.app',
  headline: 'Help for every app,',
  pitch: () => 'Guides for every liveworkspace app, in one place.',
  footer: 'livediagram, liveplanner, livedocuments, livedesign and livehuddle.',
  colours: { ground: ['#f8fafc', '#e2e8f0'], ink: '#0f172a', accent: '#475569' },
});

/** The browser asks sites not to track (Global Privacy Control or Do Not Track): nothing is sent. */
function browserOptsOut(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

let engine: ReturnType<typeof createTelemetryEngine> | null = null;
/** The All Apps help's track(): the shared engine, built on first use, as liveworkspace.app. */
export function helpTrack(category: string, action: string, type?: string): void {
  engine ??= createTelemetryEngine({
    url: telemetryServiceUrl(),
    enabled: telemetryEnabledByBuild(),
    isOptedIn: () => !browserOptsOut(),
  });
  engine.track(PLATFORM_TELEMETRY_APP, category, action, type);
}

/** No window error tracking under All Apps: the platform's ingest takes no Error events from here. */
export function installErrorTracking(_track?: unknown): void {}

// A path means one article whichever app's help shows it, so All Apps reads every app's overrides at once.
export const { helpPathTelemetryId } = createHelpTelemetryIds(
  Object.values(HELP_TELEMETRY_OVERRIDES).reduce<Record<string, string>>(
    (merged, overrides) => ({ ...merged, ...overrides }),
    {},
  ),
);
