'use client';

// The Community bar (@liveworkspace/community-ui/community-bar; liveworkspace/docs/specs/007-community/community.md
// "The community link"), in this product's words: who shared the space, the way back to its post, and Make a Copy.
// Only the author's way back to their own space (Edit Your Space) is this editor's; the bar is the shared one
// every editor draws (liveworkspace/docs/specs/022-interface-design/action-parity.md).
import { CommunityBar as SharedCommunityBar } from '@liveworkspace/community-ui/community-bar';
import { documentPath } from '@livehuddle/api-schema';
import type { CommunitySession } from '@/app/document/[id]/editor-realtime';

function ownHref(id: string): string {
  return documentPath(id);
}

export function CommunityBar({
  community,
  onMakeCopy,
  copying,
}: {
  community: CommunitySession;
  onMakeCopy: () => void;
  copying: boolean;
}) {
  const id = community.ownDocumentId;
  return (
    <SharedCommunityBar
      community={community}
      own={id ? { href: ownHref(id), label: 'Edit Your Space' } : null}
      onMakeCopy={onMakeCopy}
      copying={copying}
    />
  );
}
