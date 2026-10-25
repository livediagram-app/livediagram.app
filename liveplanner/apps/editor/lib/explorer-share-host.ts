'use client';

// What the shared Share dialog (@liveworkspace/explorer `ShareDialog`) needs from liveplanner beyond a link's
// address: a plan's tabs (a link can open one), its embed (`/embed?s=<code>`, lib/embed.ts) and live image
// (`/api/share/<code>/image.svg`, lib/live-image.ts), the Help articles, and telemetry. The editor's Share and the
// Explorer's both use it; the Explorer asks per item, and another app's item gets no embed or live image here.

import type {
  ShareHandOver,
  ShareHelpArticle,
  ShareHelpHref,
  ShareHost,
  ShareTelemetry,
} from '@liveworkspace/explorer';
import { apiLoadProject } from './api/projects';
import { embedUrlFor } from './embed';
import { helpArticleHref, type HelpArticleKey } from './help-articles';
import { liveImageUrlFor } from './live-image';
import { track } from './telemetry';

const origin = () => (typeof window === 'undefined' ? '' : window.location.origin);

export const planHandOver: ShareHandOver = {
  embedUrl: (link) => embedUrlFor(origin(), link.code),
  liveImageUrl: (link, tabId) => liveImageUrlFor(origin(), link.code, tabId),
  liveImageAlt: 'liveplanner tab',
};

const SHARE_HELP: Record<ShareHelpArticle, HelpArticleKey> = {
  sharing: 'sharing',
  shareLinkExpiry: 'shareLinkExpiry',
  sharePasswords: 'sharePasswords',
};

export const shareHelpHref: ShareHelpHref = (article) => helpArticleHref(SHARE_HELP[article]);

// Each a literal pair, so the telemetry manifest's coverage test sees it (docs/specs/017-telemetry/telemetry.md).
export const trackShare: ShareTelemetry = (action, type) => {
  switch (action) {
    case 'Copied':
      return track('UI', 'Copied', type);
    case 'Removed':
      return track('Project', 'Removed', type);
    case 'Selected':
      return track('UI', 'Selected', type);
    case 'Started':
      return track('UI', 'Started', type);
    case 'Ended':
      return track('UI', 'Ended', type);
    case 'Shared':
      return track('Project', 'Shared', type);
  }
};

/** The Explorer's Share: a plan's tabs read when the dialog opens, its embed and live image, Help, telemetry. */
export function explorerShareHost(ownerId: string | null): ShareHost {
  return {
    loadTabs: async (item) => {
      if (item.app !== 'liveplanner' || !ownerId) return [];
      const plan = await apiLoadProject(ownerId, item.id);
      return (plan?.tabs ?? []).map((t) => ({ id: t.id, name: t.name }));
    },
    handOver: (item) => (item.app === 'liveplanner' ? planHandOver : undefined),
    helpHref: shareHelpHref,
    onTelemetry: trackShare,
  };
}
