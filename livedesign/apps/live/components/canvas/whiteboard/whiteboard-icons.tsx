// The markers' glyph (docs/specs/023-draw-mode/drawing-tools.md "Markers"). It renders through the
// house Glyph primitive (docs/specs/004-interface-design/iconography.md) on the 24-unit grid, at
// the Toolbar layout strip's tile glyph size.
import { Glyph } from '@livedesign/ui';

const PEN_ICON_PX = 18;

// A marker seen from the side: the body in the tile's ink, the nib and the
// band below in the marker's own colour, the band as thick as the marker draws.
export function PenGlyph({ colour, width }: { colour: string; width: number }) {
  return (
    <Glyph size={PEN_ICON_PX} units={24}>
      <path d="M7 15 L15.5 6.5 L18 9 L9.5 17.5 L6.4 18 Z" />
      <path d="M6.4 18 L7 15 L9.5 17.5 Z" fill={colour} stroke={colour} />
      <path d="M4 21.5 H20" stroke={colour} strokeWidth={1 + width * 0.75} />
    </Glyph>
  );
}
