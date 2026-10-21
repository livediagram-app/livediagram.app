import type { ReactNode } from 'react';
import { chipColours, chipLookOf, type ShapeElement } from '@liveplanner/document';

// A badge or step number (docs/specs/009-elements/badge.md, step-number.md): the pill or disc in its look, and the
// element's ordinary label centred on it in the look's text colour, so it edits, formats and exports like any label.
export function ChipFace({
  element,
  labelNode,
  accent,
  fill,
  ink,
}: {
  element: ShapeElement;
  labelNode: ReactNode;
  // The element's resolved stroke, fill and text colours, which the look is made from.
  accent: string;
  fill: string;
  ink: string;
}) {
  const c = chipColours(chipLookOf(element), { accent, surface: fill, ink });
  return (
    <>
      <div
        aria-hidden
        data-chip-look={chipLookOf(element)}
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          // A translucent look sits on an opaque ground, so a host's border never shows through it.
          background: c.base ? `linear-gradient(${c.fill}, ${c.fill}), ${c.base}` : c.fill,
          boxShadow: c.border ? `inset 0 0 0 1.5px ${c.border}` : undefined,
        }}
      />
      <div className="absolute inset-0" style={{ color: c.text, opacity: c.textOpacity }}>
        {labelNode}
      </div>
    </>
  );
}
