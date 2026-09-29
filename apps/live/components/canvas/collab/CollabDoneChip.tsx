// The green "finished" chip in a Collaborate card's header: a resolved
// Comment panel thread ("Resolved"), an Action panel whose every action is
// done ("All Done"). One chip, so the two cards say done the same way
// (docs/specs/012-collaboration/comment-pin.md, action-panel.md).

import type { ReactNode } from 'react';
import { COLLAB_DONE_COLOR } from '@livediagram/document';
import { Chip } from '@livediagram/ui';
import { tint } from './collab-chrome';
import { CheckGlyph } from './qa/qa-parts';

export function CollabDoneChip({ children }: { children: ReactNode }) {
  return (
    <Chip
      icon={<CheckGlyph size={10} />}
      className="px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: COLLAB_DONE_COLOR, backgroundColor: tint(COLLAB_DONE_COLOR, 0.14) }}
    >
      {children}
    </Chip>
  );
}
