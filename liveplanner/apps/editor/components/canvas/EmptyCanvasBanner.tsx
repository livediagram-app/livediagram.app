'use client';

import {
  EMPTY_CARD_VIEWER_LINE,
  EmptyCanvasArtFrame,
  EmptyCanvasCard,
} from '@liveworkspace/workbench/components/canvas/EmptyCanvasCard';

// liveplanner's empty-canvas card (docs/specs/026-plan/plan-mode.md "Starting a board"): the card every editor shares
// (@liveworkspace/workbench EmptyCanvasCard), shown to a Participant or Viewer on an empty tab. An Editor gets Start
// Planning instead. A Viewer reads the passive line; a Participant, who adds stickies, text and images
// (share-roles.md), is pointed at them.
export function EmptyCanvasBanner({
  tabId,
  tabName,
  participant,
}: {
  tabId: string;
  tabName: string;
  participant: boolean;
}) {
  return (
    <EmptyCanvasCard
      tabId={tabId}
      tabName={tabName}
      art={<BoardArt />}
      line={
        participant
          ? 'Nothing here yet. Add a sticky, text or an image from the Palette to get it going.'
          : EMPTY_CARD_VIEWER_LINE
      }
    />
  );
}

const BRAND = 'var(--color-brand-500)';
const LINE = 'color-mix(in srgb, var(--color-brand-500) 45%, transparent)';

// A board: three lanes of cards, one card on its way across. Decorative.
function BoardArt() {
  const card = (x: number, y: number, accent = false) => (
    <g>
      <rect
        x={x}
        y={y}
        width="24"
        height="11"
        rx="2.5"
        className="fill-white dark:fill-slate-900"
        stroke={accent ? BRAND : LINE}
        strokeWidth="1.3"
      />
      <path d={`M${x + 5} ${y + 5.5}h12`} stroke={LINE} strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
  return (
    <EmptyCanvasArtFrame>
      <path
        d="M16 14h24M48 14h24M80 14h24"
        stroke={BRAND}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {card(16, 22)}
      {card(16, 37)}
      {card(16, 52)}
      {card(48, 22, true)}
      {card(48, 37)}
      {card(80, 22)}
    </EmptyCanvasArtFrame>
  );
}
