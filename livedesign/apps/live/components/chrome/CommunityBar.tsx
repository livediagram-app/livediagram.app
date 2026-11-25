'use client';

// The Community bar (@liveworkspace/community-ui/community-bar; liveworkspace/docs/specs/007-community/community.md
// "The community link"), in this product's words: who shared the design, the way back to its post, and Make a Copy.
// Only the author's way back to their own design (Edit Your Design) is this editor's; the bar is the shared one
// every editor draws (liveworkspace/docs/specs/022-interface-design/action-parity.md).
import { CommunityBar as SharedCommunityBar } from '@liveworkspace/community-ui/community-bar';
import type { CommunitySession } from '@/app/design/[id]/editor-realtime';

function ownHref(id: string): string {
  return `/design/${encodeURIComponent(id)}`;
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
  const id = community.ownDesignId;
  return (
    <SharedCommunityBar
      community={community}
      own={id ? { href: ownHref(id), label: 'Edit Your Design' } : null}
      onMakeCopy={onMakeCopy}
      copying={copying}
    />
  );
}
