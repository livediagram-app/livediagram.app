// How a text colour reads on one ground or several (each product's docs/specs/004-interface-design/colour-picker.md
// "Reading on its ground"): judged on every probe's ground, the worst counts, and the one shade offered passes on all
// of them. Pure.
import { textContrast, type TextGround } from './text-contrast';
import type { TextContrastProbe } from './text-contrast-probe';

export type TextJudgement = {
  // The colour judged where it reads worst, and the tone under it there.
  colour: string;
  tone: string;
  ratio: number;
  needed: number;
  passes: boolean;
  // A shade of the same hue that passes on every ground; null when it passes or none does.
  suggestion: string | null;
  // What the words sit on where it reads worst, and whether that is judged as saved or exported.
  on: TextGround['on'];
  exported: boolean;
  // How many of the texts judged fall short, of how many.
  failing: number;
  of: number;
};

/** `id` (a swatch, or null for the colour in force) judged on every probe's ground; null judges nothing. */
export function judgeText(
  probes: readonly TextContrastProbe[],
  id: string | null,
): TextJudgement | null {
  const each = probes.flatMap((probe) => {
    const colour = id === null ? probe.current : probe.colourOf(id);
    const c = colour ? textContrast(colour, probe.ground.tones, probe.large) : null;
    return c ? [{ probe, colour: colour!, c }] : [];
  });
  if (each.length === 0) return null;
  // The worst: furthest under its own target (large text's 3:1 against normal text's 4.5:1).
  const worst = each.reduce((a, b) => (b.c.ratio / b.c.needed < a.c.ratio / a.c.needed ? b : a));
  const count = (e: { probe: TextContrastProbe }) => e.probe.count ?? 1;
  const failing = each.filter((e) => !e.c.passes).reduce((n, e) => n + count(e), 0);
  return {
    colour: worst.colour,
    tone: worst.c.tone,
    ratio: worst.c.ratio,
    needed: worst.c.needed,
    passes: failing === 0,
    suggestion: failing === 0 ? null : sharedShade(each, worst.colour),
    on: worst.probe.ground.on,
    exported: worst.probe.exported,
    failing,
    of: each.reduce((n, e) => n + count(e), 0),
  };
}

// One shade that reads on every ground: the worst colour's nearest shade judged on all their tones at once, as normal
// text unless every one is large. The worst falls short on its own ground, so on all of them too.
function sharedShade(each: readonly { probe: TextContrastProbe }[], colour: string): string | null {
  const tones = [...new Set(each.flatMap((e) => e.probe.ground.tones))];
  const large = each.every((e) => e.probe.large);
  return textContrast(colour, tones, large)!.suggestion;
}
