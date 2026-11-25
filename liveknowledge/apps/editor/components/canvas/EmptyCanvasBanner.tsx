'use client';

import {
  EMPTY_CARD_VIEWER_LINE,
  EmptyCanvasArtFrame,
  EmptyCanvasCard,
} from '@liveworkspace/workbench/components/canvas/EmptyCanvasCard';

// liveknowledge's empty-canvas card (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): the card every
// editor shares (@liveworkspace/workbench EmptyCanvasCard), shown to someone who cannot edit while the knowledgebase is
// still the untouched page /new made. An Editor gets the knowledgebase's start instead.
export function EmptyCanvasBanner({ tabId, tabName }: { tabId: string; tabName: string }) {
  return (
    <EmptyCanvasCard
      tabId={tabId}
      tabName={tabName}
      art={<KnowledgeArt />}
      line={EMPTY_CARD_VIEWER_LINE}
    />
  );
}

const BRAND = 'var(--color-brand-500)';
const LINE = 'color-mix(in srgb, var(--color-brand-500) 45%, transparent)';

// A knowledgebase: a page tree beside an open page. Decorative.
function KnowledgeArt() {
  return (
    <EmptyCanvasArtFrame>
      <path
        d="M16 16h18M22 26h14M22 36h14M16 46h18M22 56h12"
        stroke={LINE}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="18" cy="26" r="1.6" fill={BRAND} />
      <rect
        x="46"
        y="10"
        width="58"
        height="52"
        rx="4"
        className="fill-white dark:fill-slate-900"
        stroke={BRAND}
        strokeWidth="1.6"
      />
      <path d="M54 20h26" stroke={BRAND} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M54 30h42M54 37h42M54 44h30" stroke={LINE} strokeWidth="1.6" strokeLinecap="round" />
    </EmptyCanvasArtFrame>
  );
}
