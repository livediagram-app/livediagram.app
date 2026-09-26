import { categoryColor } from './event-vocab';

// A chart stack's colours (docs/specs/017-telemetry/telemetry.md), carried through from the category hues
// the word cloud, metric cards and rankings already use, so a stack reads as
// part of its category at a glance.
//
// Each member's line takes its category's colour. Members that share one (a
// stack is often a single category: Diagram Actions is all Diagram) take
// shades of it, darkest first, so the lines still tell apart while the stack
// stays one family. Grouped by the colour, not the category name, since two
// categories can share a hue (Folder and Facilitator) and must still split.

type Categorised = { category: string };

// How far the shades of one hue spread, from the first member (darkest) to
// the last (lightest). Scaled by the hue's own brightness so every shade stays
// in a readable middle band: a deep hue (Page's #9d174d) mostly lightens,
// since darkening it more lands on near-black, and a bright one (Tab's amber)
// mostly darkens, since lightening it far washes out on a white card.
function spread(hex: string): [number, number] {
  const n = parseInt(hex.slice(1), 16);
  const luma = (0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) / 255;
  return [-0.4 * luma, 0.75 - 0.6 * luma];
}

// Mix a #rrggbb colour toward white (t > 0) or black (t < 0).
export function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = t > 0 ? 255 : 0;
  const amount = Math.abs(t);
  const channel = (shift: number) => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (target - c) * amount);
  };
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}

// One line colour per member, in order.
export function stackMemberColors(members: Categorised[]): string[] {
  const bases = members.map((m) => categoryColor(m.category));
  const sharing = new Map<string, number>();
  for (const b of bases) sharing.set(b, (sharing.get(b) ?? 0) + 1);
  const seen = new Map<string, number>();
  return bases.map((base) => {
    const k = sharing.get(base)!;
    const i = seen.get(base) ?? 0;
    seen.set(base, i + 1);
    if (k === 1) return base;
    const [darkest, lightest] = spread(base);
    return shade(base, darkest + ((lightest - darkest) * i) / (k - 1));
  });
}

// The stack's own colour, for its head's icon tile and its combined line: the
// hue most of its members share (the first to reach it on a tie).
export function stackAccent(members: Categorised[]): string {
  const tally = new Map<string, number>();
  let best = categoryColor(members[0]?.category ?? '');
  for (const m of members) {
    const c = categoryColor(m.category);
    const n = (tally.get(c) ?? 0) + 1;
    tally.set(c, n);
    if (n > (tally.get(best) ?? 0)) best = c;
  }
  return best;
}
