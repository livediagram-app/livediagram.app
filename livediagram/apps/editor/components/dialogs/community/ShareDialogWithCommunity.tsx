'use client';

import { useState } from 'react';
import { useCommunityEnabled } from '@livediagram/ui';
import { API_BASE } from '@/lib/api-client';
import { ShareDialog } from '@/components/dialogs/ShareDialog';
import type { ShareDialogProps } from '@/components/dialogs/ShareDialog.types';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { useCommunityPost } from '@/hooks/persistence/useCommunityPost';
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
  firstTabEmpty = false,
  ...share
}: ShareDialogProps & {
  documentId: string | null;
  documentName: string;
  signedIn: boolean;
  teamDocument: boolean;
  // The document's first tab is open and has nothing on it (docs/specs/025-community/community.md "Something to show").
  firstTabEmpty?: boolean;
}) {
  const ownerId = share.participant.id;
  // Switched off, the Community is not offered at all (docs/specs/025-community/community.md "Turning the Community
  // off"): the plain Share dialog, with nothing read.
  const communityOn = useCommunityEnabled(API_BASE);
  // Only a signed-in owner's personal, cloud document can have a post, so only then is it read.
  const eligible = communityOn && signedIn && !teamDocument && !share.offline;
  const community = useCommunityPost({ ownerId, documentId, open: eligible });
  const [publishing, setPublishing] = useState(false);
  // Back from writing a listing, the Share dialog opens on Community, where it was left.
  const [backFromListing, setBackFromListing] = useState(false);

  if (!communityOn) return <ShareDialog {...share} teamDocument={teamDocument} />;

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
          picture: null,
        }}
        onPublish={community.publish}
        onClose={() => {
          setPublishing(false);
          setBackFromListing(true);
        }}
      />
    );
  }

  return (
    <ShareDialog
      {...share}
      teamDocument={teamDocument}
      passwordLockedReason={
        community.post?.state === 'listed' ? communityCodeMessage('community_published') : null
      }
      communityListed={community.post?.state === 'listed'}
      initialTab={backFromListing ? 'community' : 'passes'}
      community={
        documentId ? (
          <CommunitySection
            signedIn={signedIn}
            signInHref={authHrefWithReturn('/sign-in/', `/document/${documentId}`)}
            teamDocument={teamDocument}
            sharePasswordSet={share.sharePasswordSet}
            firstTabEmpty={firstTabEmpty}
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
