'use client';

// What the shared Share dialog (@liveworkspace/explorer `ShareDialog`) needs from livediagram beyond a link's
// address: a canvas's tabs (a link can open one), its embed (`/embed?s=<code>`, @liveworkspace/workbench/lib/embed.ts) and live image
// (`/api/share/<code>/image.svg`, @liveworkspace/workbench/lib/live-image.ts), the Help articles, and telemetry. The editor's Share and the
// Explorer's both use it; the Explorer asks per item, and another app's item gets no embed or live image here.

import type {
  ShareHandOver,
  ShareHelpArticle,
  ShareHelpHref,
  ShareHost,
  ShareTelemetry,
} from '@liveworkspace/explorer';
import { COMMUNITY_UNKNOWN_AUTHOR } from '@livediagram/api-schema';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { apiLoadDocument } from './api/documents';
import { livediagramCommunityHost } from './community-share-host';
import { embedUrlFor } from '@liveworkspace/workbench/lib/embed';
import { helpArticleHref, type HelpArticleKey } from './help-articles';
import { liveImageUrlFor } from '@liveworkspace/workbench/lib/live-image';
import { track } from './telemetry';

const origin = () => (typeof window === 'undefined' ? '' : window.location.origin);

export const documentHandOver: ShareHandOver = {
  embedUrl: (link) => embedUrlFor(origin(), link.code),
  liveImageUrl: (link, tabId) => liveImageUrlFor(origin(), link.code, tabId),
  liveImageAlt: 'livediagram tab',
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
    case 'Shared':
      return track('Document', 'Shared', type);
    case 'Copied':
      return track('UI', 'Copied', type);
    case 'Removed':
      return track('Document', 'Removed', type);
    case 'Selected':
      return track('UI', 'Selected', type);
    case 'Started':
      return track('UI', 'Started', type);
    case 'Ended':
      return track('UI', 'Ended', type);
  }
};

/** The Explorer's Share: a canvas's tabs read when the dialog opens, its embed and live image, Help, telemetry, and
 *  its Community tab (docs/specs/025-community/community.md "Publishing") for a signed-in account's canvases while
 *  the Community is on. `account` is the signed-in person, null for a guest. */
export function explorerShareHost(
  ownerId: string | null,
  account: { id: string; name: string | null } | null = null,
  communityOn = false,
): ShareHost {
  return {
    community: (item) => {
      if (item.app !== 'livediagram' || !account || !communityOn || item.ownerId !== account.id) {
        return undefined;
      }
      return {
        // The snapshot's version is the canvas's last change, so the card preview is read once per change.
        host: livediagramCommunityHost({
          ownerId: account.id,
          documentId: item.id,
          version: item.updatedAt,
        }),
        ownerId: account.id,
        documentName: item.title,
        signedIn: true,
        communityOn,
        signInHref: authHrefWithReturn('/sign-in/', `/document/${item.id}`),
        // The Explorer has no participant colour to hand; the listing takes the account's own on publish.
        author: { name: account.name || 'You', color: COMMUNITY_UNKNOWN_AUTHOR.color },
      };
    },
    loadTabs: async (item) => {
      if (item.app !== 'livediagram' || !ownerId) return [];
      const document = await apiLoadDocument(ownerId, item.id);
      return (document?.tabs ?? []).map((t) => ({ id: t.id, name: t.name }));
    },
    handOver: (item) => (item.app === 'livediagram' ? documentHandOver : undefined),
    helpHref: shareHelpHref,
    onTelemetry: trackShare,
  };
}
