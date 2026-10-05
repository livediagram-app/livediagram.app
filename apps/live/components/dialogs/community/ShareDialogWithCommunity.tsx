'use client';

import { useState } from 'react';
import { useCommunityEnabled } from '@livediagram/ui';
import { API_BASE } from '@/lib/api-client';
import { ShareDialog } from '@/components/dialogs/ShareDialog';
import type { ShareDialogProps } from '@/components/dialogs/ShareDialog.types';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { useCommunityPost } from '@/hooks/persistence/useCommunityPost';
import { usePublishedPicture } from '@/hooks/persistence/usePublishedPicture';
import { communityCodeMessage } from '@/lib/community-errors';
import { CommunityPublishDialog } from './CommunityPublishDialog';
import { CommunitySection } from './CommunitySection';

// The Share dialog with its Community band (docs/specs/025-community/community.md "Publishing"). Owns
// the owner's post (read as the dialog opens) and swaps the Share dialog for the publish dialog while
// a listing is being written, coming back to it afterwards, so two modals never stack. Also carries the
// rule that a post and a share password exclude each other, in both directions.
export function ShareDialogWithCommunity({
  documentId,
  documentName,
  signedIn,
  teamDocument,
  ...share
}: ShareDialogProps & {
  documentId: string | null;
  documentName: string;
  signedIn: boolean;
  teamDocument: boolean;
}) {
  const ownerId = share.participant.id;
  // Switched off, the Community is not offered at all (docs/specs/025-community/community.md "Turning the Community
  // off"): the plain Share dialog, with nothing read.
  const communityOn = useCommunityEnabled(API_BASE);
  // Only a signed-in owner's personal, cloud document can have a post, so only then is it read.
  const eligible = communityOn && signedIn && !teamDocument && !share.offline;
  const community = useCommunityPost({ ownerId, documentId, open: eligible });
  const picture = usePublishedPicture();
  const [publishing, setPublishing] = useState(false);

  if (!communityOn) return <ShareDialog {...share} />;

  if (publishing && documentId) {
    return (
      <CommunityPublishDialog
        post={community.post}
        documentName={documentName}
        ownerId={ownerId}
        documentId={documentId}
        author={{
          name: share.lockedName || share.participant.name,
          color: share.participant.color,
          picture,
        }}
        onPublish={community.publish}
        onClose={() => setPublishing(false)}
      />
    );
  }

  return (
    <ShareDialog
      {...share}
      passwordLockedReason={
        community.post?.state === 'listed' ? communityCodeMessage('community_published') : null
      }
      communityListed={community.post?.state === 'listed'}
      community={
        documentId ? (
          <CommunitySection
            signedIn={signedIn}
            signInHref={authHrefWithReturn('/sign-in/', `/document/${documentId}`)}
            teamDocument={teamDocument}
            sharePassword={share.sharePassword}
            post={community.post}
            loading={community.loading}
            error={community.error}
            onPublish={() => setPublishing(true)}
            onEdit={() => setPublishing(true)}
            onRemove={community.remove}
          />
        ) : null
      }
    />
  );
}
