'use client';

// A retired element's placeholder (docs/specs/009-elements/retired-elements.md "What it looks like"): an element
// kind that moved to livehuddle, kept as stored and drawn as a calm card naming the piece and where it went. It is
// not a control: nothing on its face presses, so a press selects and a drag moves it like any element. The layout is
// the shared plan the export draws from (retiredPlaceholderPlan), so the canvas and an export match.

import { memo } from 'react';
import { HoverCard } from '@livediagram/ui';
import {
  RETIRED_ELEMENT_HINT,
  RETIRED_GLYPH_PATHS,
  RETIRED_PLACEHOLDER_TONES,
  retiredElementName,
  retiredPlaceholderPlan,
  type ShapeElement,
} from '@livediagram/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';

export const RetiredElementFace = memo(function RetiredElementFace({
  element,
  label,
}: {
  element: ShapeElement;
  label: string;
}) {
  const surface = useCanvasSurface();
  const tones = RETIRED_PLACEHOLDER_TONES[surface];
  const name = retiredElementName(element) ?? 'Retired piece';
  const plan = retiredPlaceholderPlan(element, name, label);
  return (
    <HoverCard
      title={`${name}: Moved to livehuddle`}
      description={RETIRED_ELEMENT_HINT}
      block
      className="h-full"
    >
      <div
        data-retired-element=""
        className="flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden border border-dashed px-2 text-center"
        style={{
          backgroundColor: tones.fill,
          borderColor: tones.border,
          borderRadius: plan.radius,
        }}
        role="img"
        aria-label={`${plan.title}. ${name}, moved to livehuddle.`}
      >
        {plan.glyph ? (
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tones.caption}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="mb-1 shrink-0"
          >
            {RETIRED_GLYPH_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
        ) : null}
        <span
          className="block max-w-full truncate text-[13px] font-semibold leading-tight"
          style={{ color: tones.title }}
        >
          {plan.title}
        </span>
        {plan.caption ? (
          <span
            className="block max-w-full truncate text-[11px] font-medium leading-tight"
            style={{ color: tones.caption }}
          >
            {plan.caption}
          </span>
        ) : null}
      </div>
    </HoverCard>
  );
});
