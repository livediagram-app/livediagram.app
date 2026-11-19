'use client';

// A published board's Roadmap pill (docs/specs/026-plan/public-roadmap.md "On the board"): after the board's Form pills,
// in their shape, for someone who may publish only (RoadmapBoardsContext is null for everyone else, so no one else's
// header learns the board is out). The megaphone, the roadmap's title, a green dot ("Published"), then Copy Roadmap
// Link (left to the dialog on a phone, where room is short), Open Roadmap (a new tab) and Roadmap Settings (the dialog,
// on this board). It comes with Publish and goes with Unpublish, wherever the dialog was opened.
import { CheckIcon, lucideGlyph, useCopiedFlash } from '@liveplanner/ui';
import {
  lucideCopy,
  lucideExternalLink,
  lucideMegaphone,
  lucideSettings,
} from '@liveworkspace/icons/lucide';
import type { PlanPalette } from '@/components/plan/plan-palette';
import {
  BoardStripButton,
  BoardStripPill,
  STRIP_LIVE_DOT,
} from '@/components/plan/widgets/BoardStripPill';
import { track } from '@/lib/telemetry';
import { useRoadmapOnBoard } from './RoadmapContext';

const RoadmapIcon = lucideGlyph(lucideMegaphone, 14);
const CopyIcon = lucideGlyph(lucideCopy, 13);
const OpenIcon = lucideGlyph(lucideExternalLink, 13);
const SettingsIcon = lucideGlyph(lucideSettings, 13);

export function RoadmapBoardPill({
  boardId,
  palette,
}: {
  boardId: string | undefined;
  palette: PlanPalette;
}) {
  const on = useRoadmapOnBoard(boardId);
  const { copied, flash } = useCopiedFlash(1500);
  if (!on) return null;
  const { roadmap, manage } = on;
  const url = `${window.location.origin}${roadmap.path}`;
  return (
    <span data-roadmap-strip="" className="flex min-w-0 shrink items-center pr-1.5">
      <BoardStripPill
        kind="roadmap"
        label={`${roadmap.title}, published roadmap`}
        glyph={<RoadmapIcon />}
        name={roadmap.title}
        dot={STRIP_LIVE_DOT}
        state="Published"
        palette={palette}
      >
        <BoardStripButton
          tooltip={copied ? 'Copied' : 'Copy Roadmap Link'}
          label="Copy roadmap link"
          className="phone:hidden"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(
              () => flash(),
              () => undefined,
            );
            track('Plan', 'Copied', 'Roadmap');
          }}
        >
          {copied ? <CheckIcon size={13} /> : <CopyIcon aria-hidden />}
        </BoardStripButton>
        <BoardStripButton
          tooltip="Open Roadmap"
          label={`Open roadmap ${roadmap.title}`}
          onClick={() => {
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
        >
          <OpenIcon aria-hidden />
        </BoardStripButton>
        <BoardStripButton tooltip="Roadmap Settings" label="Roadmap settings" onClick={manage}>
          <SettingsIcon aria-hidden />
        </BoardStripButton>
      </BoardStripPill>
    </span>
  );
}
