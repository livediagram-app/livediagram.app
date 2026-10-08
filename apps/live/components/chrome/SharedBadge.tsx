'use client';

import { useId, useState, type HTMLAttributes } from 'react';
import { Chip } from '@livediagram/ui';
import { SHARE_STATE_META, STATE_CHIP_HEIGHT_PX, StateDot, type ShareState } from './share-states';
import { VisibilityLegend } from './VisibilityLegend';

// The visibility pill rendered beside the document title, split out of
// EditorHeader. Share links win: a shared team document reads "Shared" as
// normal; "Team" covers the team-but-unshared case where "Private" would be a
// lie (every joined member can open it); "Local only" (docs/specs/006-document/offline-mode.md)
// supersedes "Private" for browser-only documents, matching the Explorer's Local only pill. Hovering (or focusing) the pill opens a
// legend popover explaining every badge, with the current one highlighted, so
// the states can be compared in place instead of hunting each hover card. "Public" (listed in the Community,
// docs/specs/025-community/community.md) wins over the rest but Local only: a document listed in the public
// Community is the widest audience there is, so "Private" or "Shared" would understate it.

function ShareStateChip({
  state,
  className = '',
  ...rest
}: { state: ShareState; className?: string } & HTMLAttributes<HTMLSpanElement>) {
  const m = SHARE_STATE_META[state];
  return (
    <Chip
      height={STATE_CHIP_HEIGHT_PX}
      caps
      icon={<StateDot state={state} className={m.dot} />}
      className={`${m.badge} ${className}`}
      {...rest}
    >
      {m.label}
    </Chip>
  );
}

export function SharedBadge({
  shareable,
  team,
  offline,
  community,
}: {
  shareable: boolean;
  team?: boolean;
  offline?: boolean;
  // Listed in the Community (a hidden post is not public, so it reads as the document otherwise is).
  community?: boolean;
}) {
  const state: ShareState = offline
    ? 'offline'
    : community
      ? 'community'
      : shareable
        ? 'shared'
        : team
          ? 'team'
          : 'private';
  const meta = SHARE_STATE_META[state];
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <ShareStateChip
        state={state}
        tabIndex={0}
        aria-label={meta.label}
        aria-describedby={descriptionId}
      />
      <span id={descriptionId} className="sr-only">
        {meta.description}
      </span>
      {/* The badge legend (docs/specs/006-document/offline-mode.md follow-up): every visibility state with its
          meaning, current row highlighted. Anchored below the pill; the header
          creates its own stacking context and doesn't clip overflow (the
          AuthControls menu relies on the same), so no portal is needed. */}
      {/* Every visibility state with its meaning, the current one marked (VisibilityLegend). */}
      {open ? <VisibilityLegend current={state} /> : null}
    </span>
  );
}
