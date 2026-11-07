'use client';

// The Explorer's Share gets the Community tab for the person's own plans while the Community is on
// (docs/specs/025-community/community.md "Publishing"): `ShareHost.community(item)`. Apart from the editor's own Share
// binding, so the Community's binding loads only with the Explorer.

import type { ShareHost } from '@liveworkspace/explorer';
import { COMMUNITY_UNKNOWN_AUTHOR } from '@liveplanner/api-schema';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { liveplannerCommunityHost } from './community-share-host';

/** `account` is the signed-in person, null for a guest; `guestId` is this browser's guest, if any. A guest's own
 *  item gets the tab too, with the note that sharing needs an account and Sign In to Share; their post is never read
 *  (useCommunityShareTab opens it only when signed in), so the host's owner client is never called for them. */
export function explorerCommunity(
  account: { id: string; name: string | null } | null,
  communityOn: boolean,
  guestId: string | null,
): ShareHost['community'] {
  const ownerId = account?.id ?? guestId;
  return (item) => {
    if (item.app !== 'liveplanner' || !ownerId || !communityOn || item.ownerId !== ownerId) {
      return undefined;
    }
    return {
      // The snapshot's version is the plan's last change, so the card preview is read once per change.
      host: liveplannerCommunityHost({
        ownerId,
        projectId: item.id,
        version: item.updatedAt,
      }),
      ownerId,
      documentName: item.title,
      signedIn: !!account,
      communityOn,
      signInHref: authHrefWithReturn('/sign-in/', `/project/${item.id}`),
      // The Explorer has no participant colour to hand; the listing takes the account's own on publish.
      author: { name: account?.name || 'You', color: COMMUNITY_UNKNOWN_AUTHOR.color },
    };
  };
}
