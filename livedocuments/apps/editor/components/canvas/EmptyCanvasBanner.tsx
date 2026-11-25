'use client';

import {
  EMPTY_CARD_VIEWER_LINE,
  EmptyCanvasArtFrame,
  EmptyCanvasCard,
} from '@liveworkspace/workbench/components/canvas/EmptyCanvasCard';

// livedocuments' empty-canvas card (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): the card every
// editor shares (@liveworkspace/workbench EmptyCanvasCard), shown to a Participant or Viewer while the tab is still
// the blank first page /new made. An Editor gets Start Making Pages instead. Neither role adds to a page, so both read
// the Viewer's line.
export function EmptyCanvasBanner({ tabId, tabName }: { tabId: string; tabName: string }) {
  return (
    <EmptyCanvasCard
      tabId={tabId}
      tabName={tabName}
      art={<PageArt />}
      line={EMPTY_CARD_VIEWER_LINE}
    />
  );
}

const BRAND = 'var(--color-brand-500)';
const LINE = 'color-mix(in srgb, var(--color-brand-500) 45%, transparent)';

// A page: a title, a picture and lines of text. Decorative.
function PageArt() {
  return (
    <EmptyCanvasArtFrame>
      <rect
        x="38"
        y="8"
        width="44"
        height="56"
        rx="4"
        className="fill-white dark:fill-slate-900"
        stroke={BRAND}
        strokeWidth="1.6"
      />
      <path d="M45 17h22" stroke={BRAND} strokeWidth="2.4" strokeLinecap="round" />
      <rect x="45" y="23" width="30" height="14" rx="2" fill={LINE} />
      <path d="M45 43h30M45 49h30M45 55h18" stroke={LINE} strokeWidth="1.6" strokeLinecap="round" />
    </EmptyCanvasArtFrame>
  );
}
