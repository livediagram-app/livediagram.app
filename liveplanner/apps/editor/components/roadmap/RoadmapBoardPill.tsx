'use client';

// A published board's Roadmap pill (docs/specs/026-plan/public-roadmap.md "On the board"): after the board's Form pills,
// in their shape, for someone who may publish only (RoadmapBoardsContext is null for everyone else, so no one else's
// header learns the board is out). The megaphone, the word Roadmap (the title is its accessible name), a green dot
// ("Published"), then Copy Roadmap Link, Open Roadmap (a new tab) and Roadmap Settings (the dialog, on this board). On
// a phone it is one button, the megaphone with its dot, opening Roadmap Settings: the dialog has the link and Open. It comes with Publish and goes with Unpublish, wherever the dialog was opened.
import { CheckIcon, Tooltip, lucideGlyph, useCopiedFlash } from '@liveplanner/ui';
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
    <span
      data-roadmap-strip=""
      className="flex min-w-0 shrink items-center pr-1.5 phone:shrink-0 phone:pr-0"
    >
      <BoardStripPill
        kind="roadmap"
        label={`${roadmap.title}, published roadmap`}
        glyph={<RoadmapIcon />}
        // A word, not the title: the board's own title is beside it (a roadmap starts with it), and the widgets after
        // it keep their room. The title is the pill's accessible name and Open's tooltip.
        name="Roadmap"
        dot={STRIP_LIVE_DOT}
        state="Published"
        palette={palette}
        className="phone:hidden"
      >
        <BoardStripButton
          tooltip={copied ? 'Copied' : 'Copy Roadmap Link'}
          label="Copy roadmap link"
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
          tooltip={`Open ${roadmap.title}`}
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
      {/* On a phone, where the header has room for about one pill, the roadmap is one button: the megaphone with its
          green dot, opening Roadmap Settings (the dialog has the link and Open Roadmap), so a Form pill beside it keeps
          its count and buttons. */}
      <Tooltip label="Roadmap Settings">
        <button
          type="button"
          data-roadmap-phone=""
          aria-label={`${roadmap.title}, published roadmap. Roadmap settings`}
          className="relative hidden h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 phone:inline-flex dark:hover:bg-white/10"
          style={{ borderColor: palette.border, background: palette.surface, color: palette.muted }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={manage}
        >
          <RoadmapIcon aria-hidden />
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full"
            style={{ background: STRIP_LIVE_DOT }}
          />
        </button>
      </Tooltip>
    </span>
  );
}
