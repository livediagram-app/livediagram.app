'use client';

import { useMemo, useState } from 'react';
import {
  ShareDialogWithCommunity as SharedShareDialogWithCommunity,
  type ShareDialogProps,
} from '@liveworkspace/explorer';
import { useCommunityEnabled } from '@liveworkspace/community-ui';
import { API_BASE } from '@/lib/api-client';
import { setCommunityState } from '@/lib/community-state-store';
import { communityShareInput, livedesignCommunityHost } from '@/lib/community-share-host';
import { useToast } from '@/hooks/ui/useToast';

// The editor's Share: the shared Share dialog with the Community tab beside Passes (@liveworkspace/explorer
// ShareDialogWithCommunity; docs/specs/025-community/community.md "Publishing"), bound to livedesign
// (lib/community-share-host.tsx). The header's Public badge follows the post through the community state store.
export function ShareDialogWithCommunity({
  ownerId,
  designName,
  signedIn,
  firstTabEmpty = false,
  author,
  ...share
}: ShareDialogProps & {
  // The person sharing: the post's owner.
  ownerId: string;
  designName: string;
  signedIn: boolean;
  // The design's first tab is open and has nothing on it (docs/specs/025-community/community.md "Publishing").
  firstTabEmpty?: boolean;
  // Who the listing shows as its author.
  author: { name: string; color: string };
}) {
  const designId = share.item.id;
  // Switched off, the Community is not offered at all (docs/specs/025-community/community.md "Turning the Community
  // off"): the plain Share dialog, with nothing read.
  const communityOn = useCommunityEnabled(API_BASE);
  const toast = useToast();
  // One snapshot version for the dialog's life: a fresh read when it opens, then a stable card preview.
  const [version] = useState(() => Date.now());
  const host = useMemo(
    () =>
      livedesignCommunityHost({
        ownerId,
        designId,
        version,
        notify: (text, tone) => (tone === 'error' ? toast.error(text) : toast.success(text)),
      }),
    [ownerId, designId, version, toast],
  );
  return (
    <SharedShareDialogWithCommunity
      {...share}
      community={communityShareInput({
        host,
        ownerId,
        designId,
        designName,
        signedIn,
        communityOn,
        firstTabEmpty,
        author,
        onStateChange: (state) => setCommunityState(designId, state),
      })}
    />
  );
}
