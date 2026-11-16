// A tab drawn for a review (docs/specs/027-repositories/blueprints/link-review.md "Marks"): the shared renderer's
// picture, as `graph render` and the editor's export draw it, with each changed element outlined over everything
// else. Each kind of change has its own colour and its own line, so colour is never the only mark (RL47). Pure.

import {
  contentBounds,
  r2,
  renderElementsToSvg,
  visibleLayerElements,
} from '@livediagram/document';
import type { Tab } from '@livediagram/document';
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import { REVIEW_MARK_OFFSET, REVIEW_MARK_STROKE } from './constants';
import type { ReviewStatus } from './review-diff';

export type ReviewMark = { id: string; kind: ReviewStatus };

// GitHub's diff colours, each with a line of its own.
export const MARK_STYLES: Record<ReviewStatus, { stroke: string; dash: string | null }> = {
  added: { stroke: '#1a7f37', dash: null },
  changed: { stroke: '#9a6700', dash: '8 5' },
  removed: { stroke: '#cf222e', dash: '2 5' },
};

function markRect(tab: Tab, el: Tab['elements'][number], kind: ReviewStatus): string {
  const b = contentBounds([el], undefined, tab.elements);
  const { stroke, dash } = MARK_STYLES[kind];
  const line = dash ? ` stroke-dasharray="${dash}" stroke-linecap="round"` : '';
  return `<rect x="${r2(b.x - REVIEW_MARK_OFFSET)}" y="${r2(b.y - REVIEW_MARK_OFFSET)}" width="${r2(b.w + REVIEW_MARK_OFFSET * 2)}" height="${r2(b.h + REVIEW_MARK_OFFSET * 2)}" rx="6" fill="none" stroke="${stroke}" stroke-width="${REVIEW_MARK_STROKE}"${line}/>`;
}

// The tab as SVG with its marks drawn last; a mark on an element no layer shows is left out.
export function reviewSvg(tab: Tab, marks: readonly ReviewMark[]): string {
  const svg = renderElementsToSvg(tab, { resolveIconArt: resolveIconExportArt, resolveStickerArt });
  const shown = new Map(visibleLayerElements(tab.elements, tab.layers).map((el) => [el.id, el]));
  const rects = marks.flatMap(({ id, kind }) => {
    const el = shown.get(id);
    return el ? [markRect(tab, el, kind)] : [];
  });
  if (rects.length === 0) return svg;
  const end = svg.lastIndexOf('</svg>');
  return `${svg.slice(0, end)}<g data-review-marks="">${rects.join('')}</g>\n${svg.slice(end)}`;
}
