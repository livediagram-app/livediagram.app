'use client';

// The Explorer's Share gets the Community tab for a signed-in account's own designs while the Community is on
// (docs/specs/025-community/community.md "Publishing"): `ShareHost.community(item)`. Apart from explorer-share-host.ts,
// which the design page loads eagerly for its own Share, so the Community's binding loads only with the Explorer.

import type { ShareHost } from '@liveworkspace/explorer';
import { COMMUNITY_UNKNOWN_AUTHOR } from '@livedesign/api-schema';
import { communityShareInput, livedesignCommunityHost } from './community-share-host';

/** `account` is the signed-in person, null for a guest. */
export function explorerCommunity(
  account: { id: string; name: string | null } | null,
  communityOn: boolean,
): ShareHost['community'] {
  return (item) => {
    if (item.app !== 'livedesign' || !account || !communityOn || item.ownerId !== account.id) {
      return undefined;
    }
    return communityShareInput({
      // The snapshot's version is the design's last change, so the card preview is read once per change.
      host: livedesignCommunityHost({
        ownerId: account.id,
        designId: item.id,
        version: item.updatedAt,
      }),
      ownerId: account.id,
      designId: item.id,
      designName: item.title,
      signedIn: true,
      communityOn,
      // The Explorer has no participant colour to hand; the listing takes the account's own on publish.
      author: { name: account.name || 'You', color: COMMUNITY_UNKNOWN_AUTHOR.color },
    });
  };
}
