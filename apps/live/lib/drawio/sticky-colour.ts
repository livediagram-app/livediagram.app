// A draw.io note's colours as a sticky's (docs/specs/020-import-export/drawio-import.md "Notes keep a
// sticky's colours", blueprint step 10.13). A tinted note takes the tinted sticky nearest its hue, so
// draw.io's standard swatches land on their kin (#fff2cc on Classic, #dae8fc on Sky, #e1d5e7 on
// Lilac); a grey or white one takes the neutral sticky nearest its lightness, so a pale note never
// turns yellow and a yellow one never turns white.

import { STICKY_PRESETS } from '@livediagram/document';
import { sceneOklch } from '@/lib/board-scene/colour';

/** Chroma (OKLCH) from which a note reads as tinted rather than grey (D45); 0.015 to 0.03. */
export const STICKY_TINT_MIN_CHROMA = 0.02;
/** The sticky presets that are structure rather than colour. */
const NEUTRAL_PRESETS = new Set(['sticky-slate', 'sticky-paper', 'sticky-charcoal', 'sticky-ink']);

const PRESETS = STICKY_PRESETS.map((preset) => ({
  preset,
  ok: sceneOklch(preset.fill)!,
  neutral: NEUTRAL_PRESETS.has(preset.id),
}));

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** The sticky colours nearest a note's fill: the preset's paper and its ink. */
export function noteStickyColours(fill: string): { fillColor: string; textColor: string } | null {
  const own = sceneOklch(fill.slice(0, 7));
  if (!own) return null;
  const tinted = own.c >= STICKY_TINT_MIN_CHROMA;
  let best: (typeof PRESETS)[number] | null = null;
  let bestGap = Infinity;
  for (const entry of PRESETS) {
    if (entry.neutral === tinted) continue;
    const gap = tinted ? hueGap(own.h, entry.ok.h) : Math.abs(own.l - entry.ok.l);
    if (gap < bestGap) [best, bestGap] = [entry, gap];
  }
  return best ? { fillColor: best.preset.fill, textColor: best.preset.text } : null;
}
