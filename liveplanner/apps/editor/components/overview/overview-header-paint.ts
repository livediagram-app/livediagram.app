// The Overview header's colours (docs/specs/026-plan/plan-overview.md "Header"): drawn from the Overview's theme the
// way a board's header is, so the header reads as the plan's own and a new Style visibly restyles it. The paper, ink,
// muted ink and line are the board palette a board on a tab in that theme takes (planPalette over the theme's element
// colours); the accent is the board's focus colour, leaned toward the ink until it reads as text on the paper; a
// multicolour theme's rule shows its branch colours. Pure, so the page resolves it once per style change.
import type { CSSProperties } from 'react';
import {
  contrastRatio,
  mixHex,
  planOwnColoursOf,
  planPalette,
  type Appearance,
  type ThemeDefinition,
} from '@liveplanner/project';

// Text on the header reaches WCAG AA for body text, on the paper and on the accent wash at its strongest.
export const HEADER_INK_CONTRAST = 4.5;
// How much accent the wash at the header's edges holds, mixed into the paper: less on a dark paper, where a hue mixed
// in reads stronger (and muddier).
export const HEADER_WASH_SHARE = { light: 0.16, dark: 0.12 } as const;
const LEAN_STEP = 0.1;

export type OverviewHeaderPaint = {
  paper: string;
  // The paper with the accent washed in: the header's leading edge. A multicolour theme also washes its trailing edge,
  // in its last branch colour.
  wash: string;
  washEnd: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
  // The rule along the header's top: the accent, or a multicolour theme's branch colours in order.
  rule: readonly string[];
};

// A colour leaned toward `toward` a step at a time until it reads on every ground.
function readable(colour: string, toward: string, grounds: readonly string[]): string {
  for (let share = 0; share < 1; share += LEAN_STEP) {
    const c = share === 0 ? colour : mixHex(toward, colour, share);
    if (grounds.every((g) => contrastRatio(c, g) >= HEADER_INK_CONTRAST)) return c;
  }
  return toward;
}

export function overviewHeaderPaint(
  theme: ThemeDefinition,
  scheme: Appearance,
): OverviewHeaderPaint {
  const board = planPalette(
    scheme,
    planOwnColoursOf({
      ...(theme.elementFill ? { fillColor: theme.elementFill } : {}),
      ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
      ...(theme.elementText ? { textColor: theme.elementText } : {}),
    }),
  );
  const paper = board.surface;
  const branches = (theme.palette ?? []).map((p) => p.stroke).filter((c): c is string => !!c);
  const multi = branches.length > 1;
  const share = HEADER_WASH_SHARE[scheme];
  const wash = mixHex(multi ? (branches[0] ?? board.focus) : board.focus, paper, share);
  const washEnd = multi ? mixHex(branches.at(-1) ?? board.focus, paper, share) : paper;
  const grounds = [paper, wash, washEnd];
  const ink = readable(board.text, scheme === 'dark' ? '#ffffff' : '#000000', grounds);
  return {
    paper,
    wash,
    washEnd,
    ink,
    muted: readable(board.muted, ink, grounds),
    accent: readable(board.focus, ink, grounds),
    line: board.border,
    rule: multi ? branches : [board.focus],
  };
}

// The rule's background: one colour, or the branch colours as equal hard-edged stripes.
function ruleImage(rule: readonly string[]): string {
  if (rule.length === 1) return rule[0] ?? 'transparent';
  const step = 100 / rule.length;
  const stops = rule.map(
    (c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`,
  );
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

// The header's custom properties, read by OverviewHeader's classes (each with the app's own colour as its fallback).
export function overviewHeaderVars(paint: OverviewHeaderPaint): CSSProperties {
  return {
    '--ov-head-paper': paint.paper,
    '--ov-head-bg': `linear-gradient(120deg, ${paint.wash} 0%, ${paint.paper} 55%, ${paint.washEnd} 100%)`,
    '--ov-head-ink': paint.ink,
    '--ov-head-muted': paint.muted,
    '--ov-head-accent': paint.accent,
    '--ov-head-line': paint.line,
    '--ov-head-rule': ruleImage(paint.rule),
  } as CSSProperties;
}
