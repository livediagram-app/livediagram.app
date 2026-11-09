'use client';

// A retired element's placeholder (docs/specs/009-elements/retired-elements.md "What it looks like"): an element
// kind that moved to livehuddle, kept as stored and drawn as a calm card naming the piece and where it went. It is
// not a control: nothing on its face presses, so a press selects and a drag moves it like any element. The layout is
// the shared plan the export draws from (retiredPlaceholderPlan), so the canvas and an export match.

import { memo } from 'react';
import { Glyph, HoverCard } from '@livediagram/ui';
import {
  RETIRED_ELEMENT_HINT,
  RETIRED_GLYPH_PATHS,
  RETIRED_PLACEHOLDER_TONES,
  RETIRED_TEXT,
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
        className={`flex h-full w-full flex-col items-center overflow-hidden border border-dashed text-center ${
          plan.anchor === 'top' ? 'justify-start' : 'justify-center'
        }`}
        style={{
          backgroundColor: tones.fill,
          borderColor: tones.border,
          borderRadius: plan.radius,
          padding: `${RETIRED_TEXT.padY}px ${RETIRED_TEXT.padX}px`,
          ...(plan.anchor === 'top' ? { paddingTop: RETIRED_TEXT.padY * 2 } : null),
        }}
        role="img"
        aria-label={`${plan.title}. ${name}, moved to livehuddle.`}
      >
        {plan.glyph ? (
          <Glyph
            size={20}
            units={24}
            className="shrink-0"
            style={{ color: tones.caption, marginBottom: RETIRED_TEXT.glyphRow - 20 }}
          >
            {RETIRED_GLYPH_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </Glyph>
        ) : null}
        {/* The plan's own lines (never the browser's wrap), so the canvas and an export break them the same way. */}
        {plan.titleLines.map((line, i) => (
          <span
            key={`t${i}`}
            className="block max-w-full whitespace-nowrap font-semibold"
            style={{
              color: tones.title,
              fontSize: RETIRED_TEXT.titleSize,
              lineHeight: `${RETIRED_TEXT.titleLine}px`,
            }}
          >
            {line}
          </span>
        ))}
        {plan.captionLines.map((line, i) => (
          <span
            key={`c${i}`}
            className="block max-w-full whitespace-nowrap font-medium"
            style={{
              color: tones.caption,
              fontSize: RETIRED_TEXT.captionSize,
              lineHeight: `${RETIRED_TEXT.captionLine}px`,
            }}
          >
            {line}
          </span>
        ))}
      </div>
    </HoverCard>
  );
});
