'use client';

import { PAGE_HEADING_MAX, type ShapeElement } from '@livediagram/diagram';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';

// A Page's fixed masthead (docs/specs/009-elements/page-element.md): a heading and a subtitle above the body,
// separated by a hairline rule.
//
// They are their own fields rather than the first two lines of the body,
// because a page's title is STRUCTURE, not prose. Kept apart, the body can be
// reordered, reformatted or emptied without the heading moving or vanishing,
// and the masthead can be styled as a masthead rather than as whatever the
// first line of the rich text happens to be.
//
// "Fixed" means always present: an empty heading renders its placeholder
// rather than collapsing, so the shape of a page is the same before and after
// anyone writes in it, and the body never creeps up into the title's space.
//
// Each line is an InlineTextLine: single-line plain strings edited in place,
// not the shared label editor (see that component for why).

export function PageMasthead({
  element,
  readOnly,
  onSetHeading,
  fontFamily,
  zoom,
}: {
  element: ShapeElement;
  readOnly: boolean;
  onSetHeading: (elementId: string, field: 'pageTitle' | 'pageSubtitle', value: string) => void;
  fontFamily: string | undefined;
  zoom: number;
}) {
  return (
    <div
      // Not pointer-events-none as a whole: the two lines are editable. The
      // gap between and around them stays inert so a press there still drags
      // the page (the canvas owns press-drag on an element).
      className="pointer-events-none flex shrink-0 flex-col gap-0.5 border-b pb-2"
      style={{
        borderColor: element.strokeColor ?? '#d4d4d8',
        fontFamily,
      }}
    >
      <InlineTextLine
        value={element.pageTitle ?? ''}
        placeholder="Title"
        editable={!readOnly}
        onCommit={(next) => onSetHeading(element.id, 'pageTitle', next)}
        zoom={zoom}
        maxLength={PAGE_HEADING_MAX}
        className="text-[19px] font-semibold leading-tight text-slate-900"
        ariaLabel="Page title"
      />
      <InlineTextLine
        value={element.pageSubtitle ?? ''}
        placeholder="Subtitle"
        editable={!readOnly}
        onCommit={(next) => onSetHeading(element.id, 'pageSubtitle', next)}
        zoom={zoom}
        maxLength={PAGE_HEADING_MAX}
        className="text-[12px] font-medium leading-snug text-slate-500"
        ariaLabel="Page subtitle"
      />
    </div>
  );
}
