'use client';

// Pop Out, the Call dock's last button (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint:
// space-mini-view.md): opens the mini view, a small window on top that keeps the Space's people in sight from other
// tabs and apps, and closes it again. Drawn as the call's buttons are; only where the browser has Document
// Picture-in-Picture, so desktop Safari and phones show none.
import { lucidePictureInPicture2 } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livehuddle/ui';
import {
  toggleMiniView,
  useMiniViewSupported,
  useMiniViewWindow,
} from '@/lib/mini-view/mini-view-window';
import { useCallActions, useCallSelf } from '@/lib/calls/calls-store';
import { Divider } from '@/components/palette/strip-rail-items';
import { Segment } from './CallSegment';
import { callGroupShows } from './CallStripGroup';

const PopOutIcon = lucideGlyph(lucidePictureInPicture2, 16);

export const POP_OUT_TEXT = {
  closed: {
    label: 'Pop Out',
    title: 'Pop Out',
    description:
      'Keep the Space’s people in a small window on top while you work in other tabs and apps.',
  },
  open: { label: 'Pop Out', title: 'Mini View: Open', description: 'Press to close it.' },
} as const;

export function PopOutSegment({ sharing = false }: { sharing?: boolean }) {
  const supported = useMiniViewSupported();
  const open = useMiniViewWindow() !== null;
  const self = useCallSelf();
  const actions = useCallActions();
  if (!supported) return null;
  const text = open ? POP_OUT_TEXT.open : POP_OUT_TEXT.closed;
  // A divider whenever something precedes it on the dock: the call group, or the Screen Share group.
  const after = sharing || callGroupShows(self, actions);
  return (
    <>
      {after ? <Divider /> : null}
      <Segment
        label={text.label}
        name={open ? 'Popped Out' : 'Pop Out'}
        title={text.title}
        description={text.description}
        icon={<PopOutIcon />}
        onClick={toggleMiniView}
        pressed={open}
        tone={open ? 'live' : 'rest'}
      />
    </>
  );
}
