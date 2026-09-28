// A face for each fist-of-five value (docs/specs/012-collaboration/temperature-check.md "The face"), from a
// frown (1) to a beam (5). Eyes and outline are shared; only the mouth moves,
// so the five read as one face changing its mind.

import { Glyph } from '@livediagram/ui';

const MOUTHS = [
  'M5.2 11.4Q8 8.9 10.8 11.4', // Blocked: a frown
  'M5.5 11Q8 10 10.5 11', // Doubtful: a slight frown
  'M5.5 10.6H10.5', // Okay: level
  'M5.4 9.9Q8 11.9 10.6 9.9', // Keen: a smile
  'M5 9.4Q8 13.4 11 9.4Z', // All in: a beam, open
];

export function MoodGlyph({ value, size = 20 }: { value: number; size?: number }) {
  const mouth = MOUTHS[Math.min(4, Math.max(0, value - 1))]!;
  return (
    <Glyph size={size} units={16}>
      <circle cx="8" cy="8" r="6.4" />
      <circle cx="5.9" cy="6.6" r=".75" fill="currentColor" stroke="none" />
      <circle cx="10.1" cy="6.6" r=".75" fill="currentColor" stroke="none" />
      <path d={mouth} fill={value === 5 ? 'currentColor' : 'none'} fillOpacity={0.25} />
    </Glyph>
  );
}
