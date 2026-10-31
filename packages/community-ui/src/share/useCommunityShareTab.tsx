'use client';

import { useState, type ReactNode } from 'react';
import type { CommunityAuthor, CommunityPostState } from '@liveworkspace/community';
import { CommunityGuide } from './CommunityGuide';
import { CommunityPublishDialog } from './CommunityPublishDialog';
import { CommunityPublicBadge, CommunitySection } from './CommunitySection';
import { communityCodeMessage } from './community-errors';
import { CommunityShareHostProvider, type CommunityShareHost } from './host';
import { useCommunityPost } from './useCommunityPost';

// The status line's words while the document is listed (the Share dialog's `publicNote`).
export const COMMUNITY_PUBLIC_NOTE =
  'in the Community, where anyone can find it, view it and make a copy.';

/** Where the tab is, and for whom (liveworkspace/docs/specs/007-community/community.md "The Share dialog's Community
 *  tab"): the person sharing (the post's owner), the document, and how the listing shows its author. */
export type CommunityShareTabInput = {
  host: CommunityShareHost;
  ownerId: string;
  documentId: string;
  documentName: string;
  signedIn: boolean;
  // A team library's document is not one person's to give away.
  teamDocument: boolean;
  // The Community is switched on for the document's app.
  communityOn: boolean;
  // Sign in, coming back to the document afterwards.
  signInHref: string;
  // The first tab is open and has nothing on it (the editor knows; the Explorer never does).
  firstTabEmpty?: boolean;
  author: Pick<CommunityAuthor, 'name' | 'color'>;
  onStateChange?: (state: CommunityPostState | null) => void;
};

/** What the shared Share dialog takes for the Community: its tab and the rules that hang on the post. */
export type CommunityShareDialogProps = {
  onPasswordSetChange: (set: boolean) => void;
  passwordLockedReason: string | null;
  publicNote: string | null;
  initialView: 'passes' | 'app';
  appTab: { label: string; badge?: ReactNode; panel: ReactNode };
};

export type CommunityShareTab =
  // Not offered: the Community switched off, signed out, or a team library's document.
  | { kind: 'none' }
  // The Share dialog, with these props spread over it.
  | { kind: 'share'; props: CommunityShareDialogProps }
  // The publish dialog, in the Share dialog's place, so two modals never stack.
  | { kind: 'publish'; dialog: ReactNode };

// The Community tab beside Passes. Owns the owner's post (read as the dialog opens) and swaps the Share dialog for the
// publish dialog while a listing is being written, coming back to it, on the Community tab, afterwards. Also carries
// the rule that a post and a share password exclude each other, in both directions: a listed post locks Password
// Protection, and a document behind a password cannot be published.
export function useCommunityShareTab(input: CommunityShareTabInput): CommunityShareTab {
  const { host, ownerId, documentId, signedIn, teamDocument, communityOn } = input;
  // Only a signed-in owner's personal document can have a post, so only then is it read.
  const eligible = communityOn && signedIn && !teamDocument;
  const community = useCommunityPost({
    client: host.client,
    ownerId,
    documentId,
    open: eligible,
    words: host.words,
    onStateChange: input.onStateChange,
  });
  // Whether the document's links ask for a password, as the Share dialog reads and changes them.
  const [passwordSet, setPasswordSet] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Back from the publish dialog, the Share dialog opens on the Community tab it was left from.
  const [backFromPublish, setBackFromPublish] = useState(false);

  if (!eligible) return { kind: 'none' };

  if (publishing) {
    return {
      kind: 'publish',
      dialog: (
        <CommunityShareHostProvider host={host}>
          <CommunityPublishDialog
            post={community.post}
            documentName={input.documentName}
            author={{ ...input.author, picture: null }}
            onPublish={community.publish}
            onClose={() => {
              setPublishing(false);
              setBackFromPublish(true);
            }}
          />
        </CommunityShareHostProvider>
      ),
    };
  }

  const listed = community.post?.state === 'listed';
  return {
    kind: 'share',
    props: {
      onPasswordSetChange: setPasswordSet,
      passwordLockedReason: listed ? communityCodeMessage('community_published', host.words) : null,
      publicNote: listed ? COMMUNITY_PUBLIC_NOTE : null,
      initialView: backFromPublish ? 'app' : 'passes',
      appTab: {
        label: 'Community',
        badge: listed ? <CommunityPublicBadge /> : null,
        panel: (
          <CommunityShareHostProvider host={host}>
            <CommunityGuide />
            <CommunitySection
              signedIn={signedIn}
              signInHref={input.signInHref}
              teamDocument={teamDocument}
              sharePasswordSet={passwordSet}
              firstTabEmpty={input.firstTabEmpty ?? false}
              post={community.post}
              loading={community.loading}
              error={community.error}
              onPublish={() => setPublishing(true)}
              onEdit={() => setPublishing(true)}
              onRemove={community.remove}
            />
          </CommunityShareHostProvider>
        ),
      },
    },
  };
}
