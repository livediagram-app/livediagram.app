// A stat's change line and its count-up (docs/specs/009-elements/stat-row.md). Pure: which way a change moved and the
// colour that says so, read from the change's own text, and the frames a value counts up through while its slide is
// presented. The canvas face and the export both colour from here, so they cannot drift.

import { colorWash } from '@liveworkspace/model-core/color-wash';
import type { CanvasSurface } from './colors';
import { reachContrast, THEME_TEXT_CONTRAST } from './readable-colour';

export type StatTrend = 'up' | 'down' | 'flat';

// The first character decides. Plus and the up arrows go up; the hyphen, the minus sign, the en dash and the down
// arrows go down; anything else (an equals, a right arrow, a word, a digit) is flat.
const UP_MARKS: ReadonlySet<string> = new Set(['▲', '↑', '+', '⬆', '△', '▴']);
const DOWN_MARKS: ReadonlySet<string> = new Set(['▼', '↓', '-', '−', '–', '⬇', '▽', '▾']);

/** Which way a change moved, from its first character. */
export function statTrend(change: string | undefined): StatTrend {
  const first = [...(change ?? '').trim()][0];
  if (!first) return 'flat';
  if (UP_MARKS.has(first)) return 'up';
  if (DOWN_MARKS.has(first)) return 'down';
  return 'flat';
}

// Green up, rose down: a deep shade on light paper, a light one on dark paper, each walked until it reads.
const TREND_COLOURS: Record<Exclude<StatTrend, 'flat'>, Record<CanvasSurface, string>> = {
  up: { light: '#15803d', dark: '#4ade80' },
  down: { light: '#be123c', dark: '#fb7185' },
};

/** The change pill's ink and wash. `ground` is the card's fill (what the pill sits on); `ink` the caption's colour,
 *  which a flat change takes. The ink meets 4.5:1 on the ground. */
export function statTrendColours(
  trend: StatTrend,
  surface: CanvasSurface,
  ground: string,
  ink: string,
): { ink: string; wash: string } {
  const base = trend === 'flat' ? ink : TREND_COLOURS[trend][surface];
  const readable = reachContrast(base, ground, THEME_TEXT_CONTRAST);
  return { ink: readable, wash: colorWash(readable, 0.12) };
}

// --- Count-up --------------------------------------------------------------------------------------------------

/** How long a value takes to count up, in ms. */
export const STAT_COUNT_MS = 1200;
/** How long a count waits after its slide mounts, in ms: the slide's own move in (a slide or a fade) lands first, so
 *  the count is seen from zero. */
export const STAT_COUNT_DELAY_MS = 300;

/** A value that reads as a number with words round it, split so each frame can print its own number. */
export type Countable = {
  prefix: string;
  negative: boolean;
  number: number;
  decimals: number;
  grouped: boolean;
  suffix: string;
};

// A prefix and a suffix without digits round a number: digits with an optional comma grouping and decimal part.
const COUNTABLE = /^([^\d\-−]*?)([-−]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(\D*)$/;

/** The value split for counting, or null when it does not read as one number ("24/7", "Q3", "N/A"). */
export function parseCountable(value: string): Countable | null {
  const m = COUNTABLE.exec(value.trim());
  if (!m) return null;
  const [, prefix = '', sign = '', whole = '', fraction, suffix = ''] = m;
  const digits = whole.replace(/,/g, '');
  const number = Number(fraction ? `${digits}.${fraction}` : digits);
  if (!Number.isFinite(number)) return null;
  return {
    prefix,
    negative: sign !== '',
    number,
    decimals: fraction?.length ?? 0,
    grouped: whole.includes(','),
    suffix,
  };
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function printNumber(n: number, decimals: number, grouped: boolean): string {
  const fixed = n.toFixed(decimals);
  if (!grouped) return fixed;
  const [whole = '', fraction] = fixed.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? withCommas : `${withCommas}.${fraction}`;
}

/** The value as it shows at `t` (0 to 1) of its count: the number eased up from zero, printed with its own decimal
 *  places and grouping, inside its prefix and suffix. At 1 it is the number as typed. */
export function countFrame(c: Countable, t: number): string {
  const eased = easeOutCubic(Math.min(1, Math.max(0, t)));
  const n = c.number * eased;
  const sign = c.negative && n > 0 ? '-' : '';
  return `${c.prefix}${sign}${printNumber(n, c.decimals, c.grouped)}${c.suffix}`;
}
