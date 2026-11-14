'use client';

import { SOLID_BRAND_DARK } from '@liveworkspace/ui';
import { ZoomFollowing } from './CanvasZoomContext';

// The vote dot (docs/specs/012-collaboration/session-tools.md "Smaller still it shrinks to a dot"): what the badge and
// the read-only count shrink to on an element too small on screen to carry them, as at a phone's full Fit of a large
// board. Tucked inside the element's bottom-right corner so it never reaches a neighbour, and it takes no press: a
// tap on the element casts, and zooming in brings the badge back.
export function VoteDot({
  label,
  myVotes,
  voteTotal,
}: {
  // What it says to a screen reader ("2 votes on Idea").
  label: string;
  myVotes: number;
  voteTotal: number;
}) {
  return (
    <ZoomFollowing className="lvd-vote-dot pointer-events-none absolute bottom-0 right-0 origin-bottom-right p-[3px]">
      <span
        role="img"
        aria-label={label}
        className={
          // 8 px (VOTE_DOT_PX): brand while it holds your dots, dark with only other people's, hollow while empty (transparent, so the note shows through the ring in both themes).
          'block h-2 w-2 rounded-full ' +
          (myVotes > 0
            ? `bg-brand-700 shadow-sm ring-1 ring-white ${SOLID_BRAND_DARK} dark:ring-slate-900`
            : voteTotal > 0
              ? 'bg-slate-700 shadow-sm ring-1 ring-white dark:bg-slate-200 dark:ring-slate-900'
              : 'bg-transparent ring-2 ring-slate-700 outline outline-1 outline-offset-2 outline-white')
        }
      />
    </ZoomFollowing>
  );
}
