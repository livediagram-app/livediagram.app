import { BorderStrokeIcon } from '@/components/palette/palette-style-previews';
import type { PenWidthId } from '@/lib/quick-style-pen';

// A marker width as a picture (docs/specs/023-draw-mode/draw-mode.md "Pens"), the same wherever a
// width is chosen: the marker's own popover and the quick style panel's Marker width row. The
// widths themselves (1, 1.5 and 2.5 px) are too close to tell apart drawn to scale, so each is
// drawn as the border-width preview of its step, thinnest first.
const WIDTH_PREVIEW: Record<PenWidthId, 'thin' | 'medium' | 'thick'> = {
  fine: 'thin',
  medium: 'medium',
  bold: 'thick',
};

export function PenWidthIcon({ width }: { width: PenWidthId }) {
  return <BorderStrokeIcon value={WIDTH_PREVIEW[width]} />;
}
