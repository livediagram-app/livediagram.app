'use client';

// livehuddle's binding of the Share dialog's Community tab (@liveworkspace/community-ui/share; docs/specs/025-community/
// community.md "Publishing"): its words, its owner route, its post pages, help, telemetry and the canvas's snapshot as
// the card preview's picture. The editor's Share and the Explorer's both build theirs here.

import type { ReactNode } from 'react';
import { communityPostPath } from '@livehuddle/api-schema';
import {
  COMMUNITY_APP_WORDS,
  type CommunityOwnerClient,
  type CommunityShareHost,
  type CommunityTrack,
} from '@liveworkspace/community-ui/share';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import {
  apiCommunityPopularTags,
  apiGetCommunityPost,
  apiPublishCommunityPost,
  apiRemoveCommunityPost,
} from '@/lib/api/community';
import { track } from '@/lib/telemetry';
import { COMMUNITY_APP } from '@livehuddle/api-schema';

// Each a literal pair, so the telemetry manifest's coverage test sees it (docs/specs/017-telemetry/telemetry.md):
// Shared and Changed carry the post's category (communityCategoryType), Removed the word Post.
export const trackCommunity: CommunityTrack = (action, type) => {
  switch (action) {
    case 'Shared':
      return track('Community', 'Shared', type);
    case 'Changed':
      return track('Community', 'Changed', type);
    case 'Removed':
      return track('Community', 'Removed', 'Post');
  }
};

export function livehuddleCommunityClient(
  ownerId: string,
  documentId: string,
): CommunityOwnerClient {
  return {
    get: () => apiGetCommunityPost(ownerId, documentId),
    publish: (input) => apiPublishCommunityPost(ownerId, documentId, input),
    remove: () => apiRemoveCommunityPost(ownerId, documentId),
    popularTags: apiCommunityPopularTags,
  };
}

// The card preview's picture: the canvas's own snapshot through the owner's read (the public card image only exists
// once the post does), at one version for the dialog's life.
export function communityThumbnail(
  ownerId: string,
  documentId: string,
  version: number,
): ReactNode {
  return (
    <DocumentThumbnail
      ownerId={ownerId}
      documentId={documentId}
      version={version}
      className="absolute inset-0 block h-full w-full object-contain p-5"
    />
  );
}

export function livehuddleCommunityHost(opts: {
  ownerId: string;
  documentId: string;
  // The snapshot's version (when the dialog opened, or the canvas's last change).
  version: number;
  notify?: CommunityShareHost['notify'];
}): CommunityShareHost {
  return {
    app: COMMUNITY_APP,
    words: COMMUNITY_APP_WORDS[COMMUNITY_APP],
    client: livehuddleCommunityClient(opts.ownerId, opts.documentId),
    postHref: communityPostPath,
    notify: opts.notify,
    track: trackCommunity,
    helpLink: ({ size, className }) => (
      <HelpArticleLink article="community" size={size} className={className} />
    ),
    thumbnail: communityThumbnail(opts.ownerId, opts.documentId, opts.version),
    Dialog,
  };
}
