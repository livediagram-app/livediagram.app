'use client';

import {
  EMPTY_CARD_VIEWER_LINE,
  EmptyCanvasArtFrame,
  EmptyCanvasCard,
} from '@liveworkspace/workbench/components/canvas/EmptyCanvasCard';

// livedesign's empty-canvas card (docs/specs/007-editor/new-design-route.md "The empty-canvas hint"): the card every
// editor shares (@liveworkspace/workbench EmptyCanvasCard), shown to a Participant or Viewer while the tab is still the
// blank first page /new made. An Editor gets the tab's start instead. A Viewer reads the passive line; a Participant,
// who adds stickies, text and images (share-roles.md), is pointed at them.
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
      art={<DesignArt />}
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

// An artboard: a shape, a circle and a pen curve with its handles. Decorative.
function DesignArt() {
  return (
    <EmptyCanvasArtFrame>
      <rect
        x="22"
        y="10"
        width="76"
        height="52"
        rx="5"
        className="fill-white dark:fill-slate-900"
        stroke={BRAND}
        strokeWidth="1.6"
      />
      <rect x="30" y="20" width="22" height="16" rx="3" fill={LINE} />
      <circle cx="78" cy="28" r="8" fill="none" stroke={BRAND} strokeWidth="1.6" />
      <path
        d="M32 52c10-12 22 4 34-6s14-2 22 2"
        stroke={BRAND}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect
        x="62.5"
        y="43.5"
        width="5"
        height="5"
        rx="1"
        className="fill-white dark:fill-slate-900"
        stroke={BRAND}
        strokeWidth="1.2"
      />
    </EmptyCanvasArtFrame>
  );
}
