'use client';

// livedesign's binding of the Share dialog's Community tab (@liveworkspace/community-ui/share; docs/specs/025-community/
// community.md "Publishing"): its words, its owner route, its post pages, help, telemetry and the design's first page as
// the card preview's picture. The editor's Share and the Explorer's both build theirs here.

import type { ReactNode } from 'react';
import { communityPostPath } from '@livedesign/api-schema';
import type { CommunityShareInput } from '@liveworkspace/explorer';
import {
  COMMUNITY_APP_WORDS,
  type CommunityOwnerClient,
  type CommunityShareHost,
  type CommunityTrack,
} from '@liveworkspace/community-ui/share';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DesignThumbnail } from '@/components/panels/DesignThumbnail';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import {
  apiCommunityPopularTags,
  apiGetCommunityPost,
  apiPublishCommunityPost,
  apiRemoveCommunityPost,
} from '@/lib/api/community';
import { track } from '@/lib/telemetry';

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

export function livedesignCommunityClient(ownerId: string, designId: string): CommunityOwnerClient {
  return {
    get: () => apiGetCommunityPost(ownerId, designId),
    publish: (input) => apiPublishCommunityPost(ownerId, designId, input),
    remove: () => apiRemoveCommunityPost(ownerId, designId),
    popularTags: apiCommunityPopularTags,
  };
}

// The card preview's picture: the design's own snapshot (its first page) through the owner's read (the public card
// image only exists once the post does), at one version for the dialog's life.
export function communityThumbnail(ownerId: string, designId: string, version: number): ReactNode {
  return (
    <DesignThumbnail
      ownerId={ownerId}
      designId={designId}
      version={version}
      className="absolute inset-0 block h-full w-full object-contain p-5"
    />
  );
}

export function livedesignCommunityHost(opts: {
  ownerId: string;
  designId: string;
  // The snapshot's version (when the dialog opened, or the design's last change).
  version: number;
  notify?: CommunityShareHost['notify'];
}): CommunityShareHost {
  return {
    app: 'livedesign.app',
    words: COMMUNITY_APP_WORDS['livedesign.app'],
    client: livedesignCommunityClient(opts.ownerId, opts.designId),
    postHref: communityPostPath,
    notify: opts.notify,
    track: trackCommunity,
    helpLink: ({ size, className }) => (
      <HelpArticleLink article="community" size={size} className={className} />
    ),
    thumbnail: communityThumbnail(opts.ownerId, opts.designId, opts.version),
    Dialog,
  };
}

// What the shared Share dialog takes for the Community tab, in livedesign's words: the platform's input names the
// item's title by its shared word for every app's item, and this is the one place livedesign hands it over.
export function communityShareInput(input: {
  host: CommunityShareHost;
  ownerId: string;
  designId: string;
  designName: string;
  signedIn: boolean;
  communityOn: boolean;
  // The design's first tab is open and has nothing on it (docs/specs/025-community/community.md "Something to show").
  firstTabEmpty?: boolean;
  // Who the listing shows as its author.
  author: { name: string; color: string };
  onStateChange?: CommunityShareInput['onStateChange'];
}): CommunityShareInput {
  const { designId, designName, ...rest } = input;
  return {
    ...rest,
    documentName: designName,
    signInHref: authHrefWithReturn('/sign-in/', `/design/${designId}`),
  };
}
