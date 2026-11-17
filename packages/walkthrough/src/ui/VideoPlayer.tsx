'use client';

// A screen recording's player (liveworkspace/docs/specs/006-media/walkthroughs.md "Screen recordings"): the shared
// VideoDialog, centred over the editor, with Share for its owner or an Editor.

import { walkthroughHeroArt } from '@liveworkspace/ui/dialog-hero-art/walkthrough';
import type { WalkthroughSummary } from '@liveworkspace/media/walkthrough';
import {
  Button,
  LinkIcon,
  PublicLinkPopover,
  VideoDialog,
  formatRelativeTime,
} from '@liveworkspace/ui';
import { useRef, useState } from 'react';
import type { Loaded } from '../usePlayer';
import { formatClock } from '../timeline';
import { SHARE_DESCRIPTION, SHARE_TITLE, walkthroughShareUrl } from './share-link';

export function VideoPlayer({
  loaded,
  current,
  onShare,
  onClose,
}: {
  loaded: Loaded;
  // The walkthrough as the list now has it (a link turned on while watching shows at once).
  current?: WalkthroughSummary;
  onShare: (on: boolean) => Promise<WalkthroughSummary | null>;
  onClose: () => void;
}) {
  const w = current ?? loaded.walkthrough;
  const [now] = useState(() => Date.now());
  const shareRef = useRef<HTMLButtonElement>(null);
  const [sharing, setSharing] = useState(false);
  const by = w.mine ? 'You' : (w.author ?? 'Someone');
  return (
    <>
      <VideoDialog
        art={walkthroughHeroArt}
        title={w.title}
        meta={`${formatClock(w.durationMs)} · ${by} · ${formatRelativeTime(now - w.createdAt)}`}
        src={loaded.url}
        onClose={onClose}
        actions={
          w.canDelete ? (
            <Button
              ref={shareRef}
              variant={w.shareCode ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setSharing(true)}
            >
              <span className="inline-flex items-center gap-1.5">
                <LinkIcon size={13} />
                {w.shareCode ? 'Shared' : 'Share'}
              </span>
            </Button>
          ) : null
        }
      />
      <PublicLinkPopover
        open={sharing}
        anchor={shareRef.current}
        url={w.shareCode ? walkthroughShareUrl(w.shareCode) : null}
        title={SHARE_TITLE}
        description={SHARE_DESCRIPTION}
        onShare={async (on) => (await onShare(on)) !== null}
        onClose={() => setSharing(false)}
      />
    </>
  );
}
