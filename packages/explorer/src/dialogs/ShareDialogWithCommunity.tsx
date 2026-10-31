'use client';

// The Share dialog with the Community tab beside Passes (liveworkspace/docs/specs/007-community/community.md "The
// Share dialog's Community tab"), the same in an app's editor and in every Explorer: the tab (@liveworkspace/
// community-ui) owns the owner's post and, while a listing is being written, takes the Share dialog's place with the
// publish dialog, so two modals never stack. Without a Community for the item, it is the plain Share dialog.

import { useMemo } from 'react';
import {
  useCommunityShareTab,
  type CommunityShareTabInput,
} from '@liveworkspace/community-ui/share';
import { ShareDialog, type ShareDialogProps } from './ShareDialog';
import { SECTION_LABEL } from './share/parts';

export type CommunityShareInput = Omit<CommunityShareTabInput, 'documentId' | 'teamDocument'>;

export function ShareDialogWithCommunity({
  community,
  ...share
}: ShareDialogProps & { community: CommunityShareInput }) {
  // The Community section reads as one of the Share dialog's own.
  // Its words of what happened go where the Share dialog's do, unless the host says them itself.
  const notify = share.notify;
  const host = useMemo(
    () => ({
      ...community.host,
      sectionLabelClass: SECTION_LABEL,
      notify: community.host.notify ?? notify,
    }),
    [community.host, notify],
  );
  const tab = useCommunityShareTab({
    ...community,
    host,
    documentId: share.item.id,
    teamDocument: !!share.item.teamId,
  });
  if (tab.kind === 'publish') return <>{tab.dialog}</>;
  return <ShareDialog {...share} {...(tab.kind === 'share' ? tab.props : null)} />;
}
