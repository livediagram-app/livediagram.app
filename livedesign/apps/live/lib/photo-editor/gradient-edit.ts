// The gradient editor's model (docs/specs/031-photo/photo-tools.md "Fills and gradients"): its presets, and
// a gradient's colour and opacity stops added, moved and removed. Stops stay sorted by where they sit, and
// a gradient keeps at least one stop of each kind, so dragging the last one off leaves it where it is. Pure.
import { sampleGradient, type Gradient } from '@livedesign/photo-engine';

export type StopKind = 'colour' | 'opacity';

// How far a stop dragged off the strip (in px, up or down) goes before letting go removes it.
export const STOP_REMOVE_PX = 28;

const two = (a: string, b: string, fade = false): Gradient => ({
  colours: [
    { at: 0, colour: a },
    { at: 1, colour: b },
  ],
  opacities: [
    { at: 0, opacity: 1 },
    { at: 1, opacity: fade ? 0 : 1 },
  ],
});

const spaced = (colours: readonly string[]): Gradient => ({
  colours: colours.map((colour, i) => ({ at: i / (colours.length - 1), colour })),
  opacities: [
    { at: 0, opacity: 1 },
    { at: 1, opacity: 1 },
  ],
});

/** The presets, in the editor's order: three from the colours in hand, then six colour ones. */
export function gradientPresets(
  foreground: string,
  background: string,
): readonly { name: string; gradient: Gradient }[] {
  return [
    { name: 'Foreground to Background', gradient: two(foreground, background) },
    { name: 'Foreground to Transparent', gradient: two(foreground, foreground, true) },
    { name: 'Black to White', gradient: two('#000000', '#ffffff') },
    {
      name: 'Spectrum',
      gradient: spaced([
        '#ff0000',
        '#ffff00',
        '#00ff00',
        '#00ffff',
        '#0000ff',
        '#ff00ff',
        '#ff0000',
      ]),
    },
    { name: 'Sunset', gradient: spaced(['#2b1055', '#d53369', '#f9a826']) },
    { name: 'Ocean', gradient: spaced(['#0b3d91', '#1fa2ff', '#a6ffcb']) },
    { name: 'Copper', gradient: spaced(['#3b1d0b', '#b87333', '#f3c89a', '#7a4019']) },
    { name: 'Violet to Orange', gradient: two('#5b21b6', '#f97316') },
    { name: 'Chrome', gradient: spaced(['#2b2b2b', '#f5f5f5', '#6b6b6b', '#e0e0e0', '#3a3a3a']) },
  ];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const byAt = <T extends { at: number }>(stops: T[]) => stops.sort((a, b) => a.at - b.at);
const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** A new stop at t, taking the colour or opacity the gradient has there; answers it and its index. */
export function withStop(
  g: Gradient,
  kind: StopKind,
  t: number,
): { gradient: Gradient; index: number } {
  const at = clamp01(t);
  const [r, gr, b, a] = sampleGradient(g, at);
  if (kind === 'colour') {
    const colours = byAt([...g.colours, { at, colour: `#${hex(r)}${hex(gr)}${hex(b)}` }]);
    return { gradient: { ...g, colours }, index: colours.findIndex((s) => s.at === at) };
  }
  const opacities = byAt([...g.opacities, { at, opacity: Math.round(a * 100) / 100 }]);
  return { gradient: { ...g, opacities }, index: opacities.findIndex((s) => s.at === at) };
}

/** Stop `index` moved to t (and changed by `patch`); answers the gradient and where the stop now sits. */
export function movedStop(
  g: Gradient,
  kind: StopKind,
  index: number,
  t: number,
  patch: { colour?: string; opacity?: number } = {},
): { gradient: Gradient; index: number } {
  const at = clamp01(t);
  if (kind === 'colour') {
    const stop = { ...g.colours[index]!, at, ...(patch.colour ? { colour: patch.colour } : {}) };
    const colours = byAt(g.colours.map((s, i) => (i === index ? stop : s)));
    return { gradient: { ...g, colours }, index: colours.indexOf(stop) };
  }
  const stop = {
    ...g.opacities[index]!,
    at,
    ...(patch.opacity !== undefined ? { opacity: clamp01(patch.opacity) } : {}),
  };
  const opacities = byAt(g.opacities.map((s, i) => (i === index ? stop : s)));
  return { gradient: { ...g, opacities }, index: opacities.indexOf(stop) };
}

/** Stop `index` removed; the gradient unchanged when it is the last of its kind. */
export function withoutStop(g: Gradient, kind: StopKind, index: number): Gradient {
  if (kind === 'colour')
    return g.colours.length > 1 ? { ...g, colours: g.colours.filter((_, i) => i !== index) } : g;
  return g.opacities.length > 1
    ? { ...g, opacities: g.opacities.filter((_, i) => i !== index) }
    : g;
}

/** The gradient left to right as a CSS linear-gradient, sampled at every stop of either kind. */
export function gradientCss(g: Gradient, reverse = false): string {
  const ats = [
    ...new Set([0, 1, ...g.colours.map((s) => s.at), ...g.opacities.map((s) => s.at)]),
  ].sort((a, b) => a - b);
  const stops = ats.map((t) => {
    const [r, gr, b, a] = sampleGradient(g, reverse ? 1 - t : t);
    return `rgba(${Math.round(r)}, ${Math.round(gr)}, ${Math.round(b)}, ${Math.round(a * 1000) / 1000}) ${Math.round(t * 10000) / 100}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
