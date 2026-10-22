// A face for each fist-of-five value (docs/specs/012-collaboration/temperature-check.md "The face"), from a
// frown (1) to a beam (5). Eyes and outline are shared; only the mouth moves,
// so the five read as one face changing its mind.

import { TEMPERATURE_FACE_MOUTHS } from '@livediagram/document';
import { Glyph } from '@livediagram/ui';

export function MoodGlyph({ value, size = 20 }: { value: number; size?: number }) {
  // The shared shapes, so the export draws the same five faces.
  const mouth = TEMPERATURE_FACE_MOUTHS[Math.min(4, Math.max(0, value - 1))]!;
  return (
    <Glyph size={size} units={16}>
      <circle cx="8" cy="8" r="6.4" />
      <circle cx="5.9" cy="6.6" r=".75" fill="currentColor" stroke="none" />
      <circle cx="10.1" cy="6.6" r=".75" fill="currentColor" stroke="none" />
      <path d={mouth} fill={value === 5 ? 'currentColor' : 'none'} fillOpacity={0.25} />
    </Glyph>
  );
}
