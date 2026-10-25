'use client';

import { useState } from 'react';
import { ShareDialog, type ShareDialogProps } from '@liveworkspace/explorer';
import { useCommunityEnabled } from '@livediagram/ui';
import { API_BASE } from '@/lib/api-client';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { useCommunityPost } from '@/hooks/persistence/useCommunityPost';
import { communityCodeMessage } from '@/lib/community-errors';
import { CommunityPublishDialog } from './CommunityPublishDialog';
import { CommunitySection } from './CommunitySection';

// The status line's words while the canvas is listed (docs/specs/007-editor/editor-app.md "Layout, top to bottom").
export const COMMUNITY_PUBLIC_NOTE =
  'in the Community, where anyone can find it, view it and make a copy.';

// The shared Share dialog (@liveworkspace/explorer) with livediagram's Community band below it
// (docs/specs/025-community/community.md "Publishing"). Owns the owner's post (read as the dialog opens) and swaps the
// Share dialog for the publish dialog while a listing is being written, coming back to it afterwards, so two modals
// never stack. Also carries the rule that a post and a share password exclude each other, in both directions: a
// listed post locks Password Protection, and a canvas behind a password cannot be published.
export function ShareDialogWithCommunity({
  ownerId,
  documentName,
  signedIn,
  firstTabEmpty = false,
  author,
  ...share
}: ShareDialogProps & {
  // The person sharing: the post's owner.
  ownerId: string;
  documentName: string;
  signedIn: boolean;
  // The canvas's first tab is open and has nothing on it (docs/specs/025-community/community.md "Something to show").
  firstTabEmpty?: boolean;
  // Who the listing shows as its author.
  author: { name: string; color: string };
}) {
  const documentId = share.item.id;
  const teamDocument = !!share.item.teamId;
  // Switched off, the Community is not offered at all (docs/specs/025-community/community.md "Turning the Community
  // off"): the plain Share dialog, with nothing read.
  const communityOn = useCommunityEnabled(API_BASE);
  // Only a signed-in owner's personal canvas can have a post, so only then is it read.
  const eligible = communityOn && signedIn && !teamDocument;
  const community = useCommunityPost({ ownerId, documentId, open: eligible });
  // Whether the canvas's links ask for a password, as the Share dialog reads and changes them.
  const [passwordSet, setPasswordSet] = useState(false);
  const [publishing, setPublishing] = useState(false);

  if (!eligible) return <ShareDialog {...share} />;

  if (publishing) {
    return (
      <CommunityPublishDialog
        post={community.post}
        documentName={documentName}
        ownerId={ownerId}
        documentId={documentId}
        author={{ ...author, picture: null }}
        onPublish={community.publish}
        onClose={() => setPublishing(false)}
      />
    );
  }

  return (
    <ShareDialog
      {...share}
      onPasswordSetChange={setPasswordSet}
      passwordLockedReason={
        community.post?.state === 'listed' ? communityCodeMessage('community_published') : null
      }
      publicNote={community.post?.state === 'listed' ? COMMUNITY_PUBLIC_NOTE : null}
      appSection={
        <CommunitySection
          signedIn={signedIn}
          signInHref={authHrefWithReturn('/sign-in/', `/document/${documentId}`)}
          teamDocument={teamDocument}
          sharePasswordSet={passwordSet}
          firstTabEmpty={firstTabEmpty}
          post={community.post}
          loading={community.loading}
          error={community.error}
          onPublish={() => setPublishing(true)}
          onEdit={() => setPublishing(true)}
          onRemove={community.remove}
        />
      }
    />
  );
}
