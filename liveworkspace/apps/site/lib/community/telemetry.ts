'use client';

// The Community page's telemetry (liveworkspace/docs/specs/007-community/community.md "Telemetry"): the events each
// app's own Community app always sent, now sent by liveworkspace.app's one page in the name of the app whose address
// it is on, so each app's Community charts keep counting. Category `Community`, and every type a preset value, never
// post content (no titles, tags or search text): each is literal below, so the dashboards' emitter scan reads them
// (apps/site/app/telemetry/platform-emitters.ts PLATFORM_ROOTS).
//
// The same policy as the apps' public sites (@liveworkspace/telemetry-client createLazyTrack): on in a production
// build unless turned off, and the app's opt-out as its editor keeps it in this browser (the same origin, so the same
// storage). On liveworkspace.app itself, where the page shows every app's posts and no app is the sender, nothing is
// sent.

import { createLazyTrack, type TelemetryTrack } from '@liveworkspace/telemetry-client';
import { DEVICE_PREFERENCES } from '@liveworkspace/settings/device';
import type { CommunityApp, CommunityReportReason } from '@liveworkspace/community';
import { pageApp, workspaceOrigin } from '@/lib/explorer/page-app';

/** The gallery filters the Community sends as `Community·Selected·<type>`. */
export type CommunitySelection = 'Category' | 'Tag' | 'Sort' | 'Mine';

/** What the pages report, each event a preset value. */
export type CommunitySiteTelemetry = {
  openedPost: () => void;
  likedPost: () => void;
  unlikedPost: () => void;
  copiedPost: () => void;
  reported: (reason: CommunityReportReason) => void;
  searched: () => void;
  selected: (what: CommunitySelection) => void;
  /** A help deep link followed (`UI·Opened·<article id>`, as every help deep link sends). */
  openedHelp: (article: 'sharing' | 'finding') => void;
};

// Next inlines `process.env.NEXT_PUBLIC_*` at build time: on in production unless turned off, in development only
// when asked for (the telemetry Worker may not be running).
const ENABLED =
  process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true' ||
  (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_TELEMETRY_ENABLED !== 'false');

// One emitter for the page's app, built on its first event (a visit that never acts builds none).
let emitter: { app: CommunityApp; track: TelemetryTrack } | null = null;

function siteTrack(category: string, action: string, type: string) {
  const host = pageApp();
  if (!host) return;
  const app = `${host}.app` as CommunityApp;
  if (emitter?.app !== app) {
    emitter = {
      app,
      track: createLazyTrack({
        // The page is on the app's address, where `/api/telemetry` is the app's: liveworkspace.app's takes every app's.
        url: process.env.NEXT_PUBLIC_TELEMETRY_URL || `${workspaceOrigin()}/api/telemetry`,
        app,
        enabled: ENABLED,
        storageKey: DEVICE_PREFERENCES[app].storageKey,
      }),
    };
  }
  emitter.track(category, action, type);
}

function reported(reason: CommunityReportReason) {
  switch (reason) {
    case 'spam':
      return siteTrack('Community', 'Reported', 'Spam');
    case 'offensive':
      return siteTrack('Community', 'Reported', 'Offensive');
    case 'personal-info':
      return siteTrack('Community', 'Reported', 'PersonalInfo');
    case 'copyright':
      return siteTrack('Community', 'Reported', 'Copyright');
    case 'other':
      return siteTrack('Community', 'Reported', 'Other');
  }
}

function selected(what: CommunitySelection) {
  switch (what) {
    case 'Category':
      return siteTrack('Community', 'Selected', 'Category');
    case 'Tag':
      return siteTrack('Community', 'Selected', 'Tag');
    case 'Sort':
      return siteTrack('Community', 'Selected', 'Sort');
    case 'Mine':
      return siteTrack('Community', 'Selected', 'Mine');
  }
}

export const communityTelemetry: CommunitySiteTelemetry = {
  openedPost: () => siteTrack('Community', 'Opened', 'Post'),
  likedPost: () => siteTrack('Community', 'Liked', 'Post'),
  unlikedPost: () => siteTrack('Community', 'Unliked', 'Post'),
  copiedPost: () => siteTrack('Community', 'Copied', 'Post'),
  reported,
  searched: () => siteTrack('Community', 'Searched', 'Query'),
  selected,
  openedHelp: (article) =>
    article === 'sharing'
      ? siteTrack('UI', 'Opened', 'community')
      : siteTrack('UI', 'Opened', 'finding-community-documents'),
};

/** For tests: forget the page's emitter. */
export function resetCommunityTelemetry() {
  emitter = null;
}
