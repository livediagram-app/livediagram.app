'use client';

// The Explorer's telemetry on liveworkspace.app (liveworkspace/docs/telemetry.md "The Explorer on
// liveworkspace.app"): the reports @liveworkspace/explorer hands its host, sent to the telemetry service the way
// every app sends its own (@liveworkspace/telemetry's batching engine: one batch per app every 10 seconds and on
// page hide, never a request per event). Each event counts for the app the page is filtered to, or for
// liveworkspace.app when it shows All Apps; a Share dialog's for the app of the item it shares. Only the Explorer's
// own events leave (EXPLORER_TELEMETRY_EVENTS), the names the apps' Explorers always sent, so each app's dashboard
// keeps counting them.
//
// The person's choice holds: signed in, their `telemetryEnabled` setting (the `all` scope every app shares, off
// only when set off); a guest, whose choice lives in each app's own browser storage, sends nothing when the browser
// asks sites not to track (Global Privacy Control or Do Not Track). Until the setting is read, events wait (a few
// at most) rather than go out unasked.

import {
  isExplorerTelemetryEvent,
  PLATFORM_TELEMETRY_APP,
  type TelemetrySender,
} from '@liveworkspace/telemetry';
import { createTelemetryEngine, TELEMETRY_MAX_BUFFER } from '@liveworkspace/telemetry/emitter';
import type {
  HomeTelemetry,
  InboxTelemetry,
  LensTelemetryType,
  OrganiseTelemetry,
  ShareHostTelemetry,
  SignInBannerTelemetry,
  TimelineTelemetry,
  ViewModeTelemetry,
  WelcomeTelemetryType,
} from '@liveworkspace/explorer';
import { APP_ITEMS, isAppName, type AppName } from '@liveworkspace/sites';
import { pageApp, workspaceOrigin } from './page-app';

// Next inlines `process.env.NEXT_PUBLIC_*` at build time. On in a production build unless turned off; in
// development only when asked for (the telemetry Worker may not be running).
const ENABLED =
  process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true' ||
  (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_TELEMETRY_ENABLED !== 'false');
// The service is on this origin (/api/telemetry; the dev server proxies it). On an app's own address (page-app.ts)
// that path is the app's, so events go to liveworkspace.app's in full, which takes every app's.
const SERVICE_URL =
  process.env.NEXT_PUBLIC_TELEMETRY_URL ||
  (pageApp() ? `${workspaceOrigin()}/api/telemetry` : '/api/telemetry');

type Consent = 'unknown' | 'yes' | 'no';

let consent: Consent = 'unknown';
let sender: TelemetrySender = PLATFORM_TELEMETRY_APP;
// Events tracked before the person's choice is known, sent or dropped once it is.
let waiting: { app: TelemetrySender; category: string; action: string; type: string | null }[] = [];

const engine = createTelemetryEngine({
  url: SERVICE_URL,
  enabled: ENABLED,
  isOptedIn: () => consent === 'yes',
});

/** The app an app's events count for on the dashboard (`liveplanner.app`). */
export function senderOfApp(app: AppName): TelemetrySender {
  return APP_ITEMS[app].site;
}

/** Who the page's events count for: the app it is filtered to, or liveworkspace.app for All Apps (on liveworkspace.app). */
export function setExplorerSender(app: AppName, filter: 'app' | 'all') {
  // On an app's own address every event is that app's: the service takes a page's events only for its own origin.
  const host = pageApp();
  if (host) {
    sender = senderOfApp(host);
    return;
  }
  sender = filter === 'app' ? senderOfApp(app) : PLATFORM_TELEMETRY_APP;
}

/** The browser asks sites not to track. */
export function browserOptsOut(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

/** The person's choice, once known: a signed-in person's `telemetryEnabled` (unset reads as on), or for a guest
 *  null, which follows the browser. Events that waited for it are sent or dropped. */
export function setExplorerConsent(telemetryEnabled: boolean | null) {
  consent =
    telemetryEnabled === null ? (browserOptsOut() ? 'no' : 'yes') : telemetryEnabled ? 'yes' : 'no';
  const held = waiting;
  waiting = [];
  if (consent === 'yes') for (const e of held) engine.track(e.app, e.category, e.action, e.type);
}

// The one emitter. `category` and `action` are literal at every call below, so the dashboards' emitter scan
// (apps/site/app/telemetry/platform-emitters.ts) reads each pair; the type is checked against the Explorer's
// closed list before anything is kept.
function track(category: string, action: string, type?: string | null, app = sender) {
  if (!ENABLED) return;
  if (!isExplorerTelemetryEvent({ category, action, type: type ?? null })) return;
  if (consent === 'unknown') {
    if (waiting.length < TELEMETRY_MAX_BUFFER)
      waiting.push({ app, category, action, type: type ?? null });
    return;
  }
  engine.track(app, category, action, type);
}

// ---------- The Explorer's host hooks ------------------------------------------------------------------------

export const trackTimeline: TimelineTelemetry = (action, type) => {
  switch (action) {
    case 'Changed':
      return track('Timeline', 'Changed', type);
    case 'Selected':
      return track('Timeline', 'Selected', type);
    case 'Loaded':
      return track('Timeline', 'Loaded', type);
    case 'Opened':
      return track('Timeline', 'Opened', type);
    case 'Removed':
      return track('Timeline', 'Removed', type);
  }
};

export const trackHome: HomeTelemetry = (action, type) => {
  switch (action) {
    case 'Selected':
      return track('Home', 'Selected', type);
    case 'Opened':
      return track('Home', 'Opened', type);
    case 'Loaded':
      return track('Home', 'Loaded', type);
  }
};

// Folders, default folders, the Trash and team libraries. An event about one item (or one app's default folder)
// counts for that app, whatever the page is filtered to; a folder's for the page's app. An item's team events name
// it by its app's noun, a literal per app so the dashboards read each.
export const trackOrganise: OrganiseTelemetry = (event, type, itemApp) => {
  const app = itemApp && isAppName(itemApp) ? senderOfApp(itemApp) : sender;
  switch (event) {
    case 'Folder·Created':
      return track('Folder', 'Created', type, app);
    case 'Folder·Moved':
      return track('Folder', 'Moved', type, app);
    case 'Folder·Deleted':
      return track('Folder', 'Deleted', type, app);
    case 'Folder·Changed':
      return track('Folder', 'Changed', type, app);
    case 'Folder·Cleared':
      return track('Folder', 'Cleared', type, app);
    case 'Trash·Restored':
      return track('Trash', 'Restored', type, app);
    case 'Trash·Deleted':
      return track('Trash', 'Deleted', type, app);
    case 'Trash·Cleared':
      return track('Trash', 'Cleared', type, app);
    case 'Team·Added':
      if (itemApp === 'liveplanner') return track('Team', 'Added', 'Project', app);
      if (itemApp === 'livedesign') return track('Team', 'Added', 'Design', app);
      return track('Team', 'Added', 'Document', app);
    case 'Team·Moved':
      if (itemApp === 'liveplanner') return track('Team', 'Moved', 'Project', app);
      if (itemApp === 'livedesign') return track('Team', 'Moved', 'Design', app);
      return track('Team', 'Moved', 'Document', app);
    case 'Team·Removed':
      if (itemApp === 'liveplanner') return track('Team', 'Removed', 'Project', app);
      if (itemApp === 'livedesign') return track('Team', 'Removed', 'Design', app);
      return track('Team', 'Removed', 'Document', app);
  }
};

export const trackWelcome = (type: WelcomeTelemetryType) => track('Home', 'Selected', type);
export const trackWelcomeOpened = () => track('Home', 'Opened', 'Welcome');

export const trackLens = (type: LensTelemetryType) => track('Explorer', 'Selected', type);

export const trackInbox: InboxTelemetry = (action, type) => {
  switch (action) {
    case 'Opened':
      return track('Activity', 'Opened');
    case 'Selected':
      return track('Activity', 'Selected', type);
    case 'Loaded':
      return track('Activity', 'Loaded', type);
  }
};

export const trackViewToggled = (type: ViewModeTelemetry) => track('UI', 'Toggled', type);

export const trackHomeBannerOff = () => track('UI', 'Toggled', 'HomeBannerOff');

export const trackSignInBanner: SignInBannerTelemetry = (action, type) => {
  switch (action) {
    case 'Selected':
      return track('UI', 'Selected', type);
    case 'Opened':
      return track('UI', 'Opened', type);
    case 'Closed':
      return track('UI', 'Closed', type);
  }
};

// The Share dialog's, for the app of the item it shares (whatever the page is filtered to). A revoked pass counts
// under the item's own noun: liveplanner's Project, the others' Document.
export const trackShare: ShareHostTelemetry = (action, type, item) => {
  const app = isAppName(item.app) ? senderOfApp(item.app) : sender;
  switch (action) {
    case 'Copied':
      return track('UI', 'Copied', type, app);
    case 'Selected':
      return track('UI', 'Selected', type, app);
    case 'Started':
      return track('UI', 'Started', type, app);
    case 'Ended':
      return track('UI', 'Ended', type, app);
    case 'Removed':
      return item.app === 'liveplanner'
        ? track('Project', 'Removed', type, app)
        : track('Document', 'Removed', type, app);
    case 'Shared':
      return item.app === 'liveplanner'
        ? track('Project', 'Shared', type, app)
        : track('Document', 'Shared', type, app);
  }
};

/** For tests: back to the page's first state. */
export function __resetExplorerTelemetry() {
  consent = 'unknown';
  sender = PLATFORM_TELEMETRY_APP;
  waiting = [];
}
