'use client';

// The Snapshots button in the footer's tool cluster (liveworkspace/docs/specs/014-snapshots/snapshots.md "In the
// editor"; blueprint SN23): just before Settings in every app, drawn only inside a door, so only for someone who may
// use snapshots; the Explorer's bar has none. Built on the footer's own button classes, as Automations and History are.

import { HoverCard } from '@liveworkspace/ui';
import {
  CHROME_BTN,
  CHROME_BTN_LABELLED,
  ChromeLabel,
} from '@liveworkspace/workbench/components/chrome/chrome-button';
import { useSnapshotsDoor } from './door';
import { SnapshotGlyph } from './glyphs';

export function SnapshotsButton({ labelled = false }: { labelled?: boolean }) {
  const door = useSnapshotsDoor();
  if (!door) return null;
  return (
    <HoverCard
      title="Snapshots"
      description={`Save points for the whole ${door.door.noun}. Revert to one to undo a big change.`}
    >
      <button
        type="button"
        onClick={door.open}
        aria-label="Snapshots"
        data-snapshots-button=""
        className={labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN}
      >
        <SnapshotGlyph />
        <ChromeLabel show={labelled}>Snapshots</ChromeLabel>
      </button>
    </HoverCard>
  );
}
