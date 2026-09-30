// The shared retro kit (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the parts every
// retrospective format is built from, so a team rotating between the
// Retrospective, Start / Stop / Continue, Mad / Sad / Glad, 4Ls and Sailboat
// meets the same ritual each time. The heading and how-to, the opening rail
// (a temperature check over a writing timer and a dot vote, then a muted
// facilitation note), the tinted column with its deep-hue header, glyph and
// prompt, stickies in the column's hue, and the neutral Action items panel
// whose checklist names an owner and a day for every line.
//
// Every part carries its layer: containers, headers, glyphs and prompts are
// the "Board" scaffold; the title, notes, tools and checklists ride the
// "Stickies" content layer, so they stay usable when the board is locked.
//
// Pure: every helper returns fresh elements.

import { createShape, createSticky, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

export const SCAFFOLD = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID } as const;
export const CONTENT = { layerId: TEMPLATE_CONTENT_LAYER_ID } as const;

// The measurements the formats share, so a column in one reads like a
// column in another.
export const RETRO = {
  colW: 360,
  railW: 320,
  gap: 32,
  pad: 20,
  headerH: 48,
  hintH: 28,
  stickyH: 116,
  stickyGap: 16,
  iconSize: 40,
  titleH: 52,
  subtitleH: 30,
  headGap: 28,
  tempH: 300,
  buttonH: 96,
  checkRowH: 40,
} as const;

export const RETRO_MUTED = '#64748b';
export const RETRO_INK = '#0f172a';

// A column's colour family: a pale container, a mid border, a deep header
// and glyph, and a sticky one step deeper than the container with ink from
// the same hue.
export type RetroHue = {
  fill: string;
  stroke: string;
  headerColor: string;
  sticky: { fill: string; text: string };
};

export const RETRO_HUES = {
  green: {
    fill: '#dcfce7',
    stroke: '#86efac',
    headerColor: '#15803d',
    sticky: { fill: '#bbf7d0', text: '#052e16' },
  },
  rose: {
    fill: '#ffe4e6',
    stroke: '#fda4af',
    headerColor: '#be123c',
    sticky: { fill: '#fecdd3', text: '#4c0519' },
  },
  violet: {
    fill: '#ede9fe',
    stroke: '#c4b5fd',
    headerColor: '#6d28d9',
    sticky: { fill: '#e9d5ff', text: '#3b0764' },
  },
  sky: {
    fill: '#e0f2fe',
    stroke: '#7dd3fc',
    headerColor: '#0369a1',
    sticky: { fill: '#bae6fd', text: '#082f49' },
  },
  orange: {
    fill: '#ffedd5',
    stroke: '#fdba74',
    headerColor: '#c2410c',
    sticky: { fill: '#fed7aa', text: '#431407' },
  },
  blue: {
    fill: '#dbeafe',
    stroke: '#93c5fd',
    headerColor: '#1d4ed8',
    sticky: { fill: '#bfdbfe', text: '#172554' },
  },
  lime: {
    fill: '#ecfccb',
    stroke: '#bef264',
    headerColor: '#4d7c0f',
    sticky: { fill: '#d9f99d', text: '#1a2e05' },
  },
  amber: {
    fill: '#fef3c7',
    stroke: '#fcd34d',
    headerColor: '#b45309',
    sticky: { fill: '#fde68a', text: '#451a03' },
  },
  teal: {
    fill: '#ccfbf1',
    stroke: '#5eead4',
    headerColor: '#0f766e',
    sticky: { fill: '#99f6e4', text: '#042f2e' },
  },
  slate: {
    fill: '#e2e8f0',
    stroke: '#94a3b8',
    headerColor: '#334155',
    sticky: { fill: '#cbd5e1', text: '#0f172a' },
  },
} satisfies Record<string, RetroHue>;

// The bold title (content, so it is renamed like any note) over the one-line
// how-to (scaffold).
export function retroHeading(x: number, y: number, width: number, title: string, howTo: string) {
  return [
    {
      ...createText(x, y),
      width,
      height: RETRO.titleH,
      label: title,
      textSize: 'lg' as const,
      textBold: true,
      textAlignX: 'left' as const,
      ...CONTENT,
    },
    {
      ...createText(x, y + RETRO.titleH),
      width,
      height: RETRO.subtitleH,
      label: howTo,
      textSize: 'sm' as const,
      textColor: RETRO_MUTED,
      textAlignX: 'left' as const,
      ...SCAFFOLD,
    },
  ] satisfies Element[];
}

// The fist-of-five that opens every format: the room's mood first.
export function moodCheck(x: number, y: number, width: number, height: number, question: string) {
  return {
    ...createShape('temperature', x, y),
    width,
    height,
    label: question,
    ...CONTENT,
  } satisfies Element;
}

// The two tools the ritual runs on: a writing timer and a dot vote, side by
// side across the rail.
export function sessionButtons(
  x: number,
  y: number,
  width: number,
  tools: { minutes: number; dots: number },
): Element[] {
  const w = (width - 16) / 2;
  return [
    {
      ...createShape('session-button', x, y),
      width: w,
      height: RETRO.buttonH,
      session: { tool: 'timer', minutes: tools.minutes },
      ...CONTENT,
    },
    {
      ...createShape('session-button', x + w + 16, y),
      width: w,
      height: RETRO.buttonH,
      session: { tool: 'vote', dots: tools.dots },
      ...CONTENT,
    },
  ];
}

// A muted line of guidance, top-aligned so it reads as a caption under a tool.
export function railNote(x: number, y: number, width: number, height: number, label: string) {
  return {
    ...createText(x, y),
    width,
    height,
    label,
    textSize: 'sm' as const,
    textColor: RETRO_MUTED,
    textAlignX: 'left' as const,
    textAlignY: 'top' as const,
    ...SCAFFOLD,
  } satisfies Element;
}

// The standard opening rail: mood check, timer + vote, facilitation note
// filling the rest of `height`.
export function retroRail(
  x: number,
  top: number,
  height: number,
  opts: { question: string; minutes: number; dots: number; note: string; width?: number },
): Element[] {
  const width = opts.width ?? RETRO.railW;
  const buttonY = top + RETRO.tempH + 24;
  const noteY = buttonY + RETRO.buttonH + 20;
  return [
    moodCheck(x, top, width, RETRO.tempH, opts.question),
    ...sessionButtons(x, buttonY, width, opts),
    railNote(x, noteY, width, height - (noteY - top), opts.note),
  ];
}

// A tinted container: the column (or quadrant, or zone) behind the notes.
export function retroPanel(
  x: number,
  y: number,
  width: number,
  height: number,
  hue: Pick<RetroHue, 'fill' | 'stroke'>,
  extra: Partial<Element> = {},
): Element {
  return {
    ...createShape('square', x, y),
    width,
    height,
    fillColor: hue.fill,
    strokeColor: hue.stroke,
    ...extra,
    ...SCAFFOLD,
  } as Element;
}

// A column header: the name in the deep hue with its line-art glyph pinned
// right, and the prompt muted underneath.
export function retroHeader(
  x: number,
  y: number,
  width: number,
  label: string,
  hint: string,
  icon: string,
  color: string,
): Element[] {
  const { pad, headerH, hintH, iconSize } = RETRO;
  return [
    {
      ...createText(x + pad, y + pad),
      width: width - pad * 2 - iconSize,
      height: headerH,
      label,
      textSize: 'lg',
      textAlignX: 'left',
      textColor: color,
      ...SCAFFOLD,
    },
    {
      ...createShape('icon', x + width - pad - iconSize, y + pad + (headerH - iconSize) / 2),
      width: iconSize,
      height: iconSize,
      iconId: icon,
      strokeColor: color,
      ...SCAFFOLD,
    },
    {
      ...createText(x + pad, y + pad + headerH),
      width: width - pad * 2,
      height: hintH,
      label: hint,
      textSize: 'sm',
      textColor: RETRO_MUTED,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
  ];
}

// One note on a sticky in the column's own hue.
export function retroSticky(
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  sticky: RetroHue['sticky'],
): Element {
  return {
    ...createSticky(x, y),
    width,
    height,
    label,
    textSize: 'sm',
    fillColor: sticky.fill,
    textColor: sticky.text,
    ...CONTENT,
  };
}

// A stack of notes down a column, `gap` apart.
export function stickyStack(
  x: number,
  y: number,
  width: number,
  height: number,
  notes: readonly string[],
  sticky: RetroHue['sticky'],
  gap: number = RETRO.stickyGap,
): Element[] {
  return notes.map((note, i) =>
    retroSticky(x, y + i * (height + gap), width, height, note, sticky),
  );
}

// The height of a column holding `notes` stickies, header to bottom padding.
export const retroColumnHeight = (notes: number, stickyH: number = RETRO.stickyH) =>
  RETRO.pad +
  RETRO.headerH +
  RETRO.hintH +
  RETRO.stickyGap +
  notes * stickyH +
  (notes - 1) * RETRO.stickyGap +
  RETRO.pad;

// The top of the notes inside a column that starts at `top`.
export const retroNotesTop = (top: number) =>
  top + RETRO.pad + RETRO.headerH + RETRO.hintH + RETRO.stickyGap;

// A full note column: container, header and a stack of stickies.
export function retroColumn(
  x: number,
  top: number,
  height: number,
  col: { label: string; hint: string; icon: string; hue: RetroHue; notes: readonly string[] },
  width: number = RETRO.colW,
): Element[] {
  const { pad } = RETRO;
  return [
    retroPanel(x, top, width, height, col.hue),
    ...retroHeader(x, top, width, col.label, col.hint, col.icon, col.hue.headerColor),
    ...stickyStack(
      x + pad,
      retroNotesTop(top),
      width - pad * 2,
      RETRO.stickyH,
      col.notes,
      col.hue.sticky,
    ),
  ];
}

// A checklist sized to its rows; every line reads "what · who · when".
export function actionChecklist(
  x: number,
  y: number,
  width: number,
  items: readonly string[],
  done: readonly boolean[] = [],
): Element {
  return {
    ...createShape('checklist', x, y),
    width,
    height: checklistHeight(items.length),
    checklistItems: items.map((text, i) => ({ text, done: done[i] ?? false })),
    ...CONTENT,
  };
}

export const checklistHeight = (rows: number) => rows * RETRO.checkRowH + 24;

// The neutral, heavier-bordered paper the Action items sit on: the output of
// the board rather than a fourth opinion.
export function actionsPanel(x: number, y: number, width: number, height: number): Element {
  return retroPanel(
    x,
    y,
    width,
    height,
    { fill: '#f8fafc', stroke: '#94a3b8' },
    { strokeWidth: 'thick' },
  );
}

// The closing column every column format shares: the panel, its header and
// the checklist under it.
export function actionsColumn(
  x: number,
  top: number,
  height: number,
  opts: { hint: string; items: readonly string[]; label?: string; width?: number },
): Element[] {
  const width = opts.width ?? RETRO.colW;
  return [
    actionsPanel(x, top, width, height),
    ...retroHeader(
      x,
      top,
      width,
      opts.label ?? 'Action items',
      opts.hint,
      'check-circle',
      RETRO_INK,
    ),
    actionChecklist(x + RETRO.pad, retroNotesTop(top), width - RETRO.pad * 2, opts.items),
  ];
}

// A bold sub-heading inside a light panel. Dark ink is set explicitly so it
// stays legible on the light paper under a dark canvas.
export function panelHeading(x: number, y: number, width: number, label: string): Element {
  return {
    ...createText(x, y),
    width,
    height: 36,
    label,
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    textColor: RETRO_INK,
    ...SCAFFOLD,
  };
}
