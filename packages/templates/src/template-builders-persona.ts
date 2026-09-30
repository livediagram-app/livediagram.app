// The User persona template (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): Maya Chen, a Plateful customer, laid out as the one-page
// profile sheet a UX research team hands over, not as a form to fill in.
//
// A profile card leads down the left: a cover band, her sticker portrait,
// name and archetype, four passport-style facts, the three numbers the team
// quotes, a pull quote in her own voice and the research the whole sheet
// rests on. To its right, three tinted sections (Goals / Frustrations /
// Behaviours) carry short notes on stickies in their own hue; under them a
// Personality block places her between pairs of poles with progress bars,
// beside Channels (where to reach her) and a tech-comfort rating. A deep teal
// How we help band closes it: each need she has, answered by what we build.
//
// It complements the empathy map rather than repeating it: the empathy map
// captures raw research (says / thinks / does / feels); the persona is the
// synthesis a team designs against. Every panel keeps its own paper colour
// and ink in both canvas themes, so the sheet reads as a printed deliverable
// in dark mode too. Panels, headers and glyphs are the "Card" scaffold; the
// portrait, facts, notes, bars, rating and answers ride "Details".
//
// The profile card is its own module (template-persona-profile.ts), the copy
// another (template-persona-data.ts).
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createSticky, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import {
  PERSONA_CHANNELS,
  PERSONA_HELP,
  PERSONA_SECTIONS,
  PERSONA_SPECTRUMS,
} from './template-persona-data';
import { PERSONA_CARD_W, PERSONA_MUTED, personaProfileCard } from './template-persona-profile';

const MUTED = PERSONA_MUTED;

const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };

const CARD_W = PERSONA_CARD_W;
const GAP = 28;
const COL_W = 352;
const PAD = 22;
const HEADER_H = 44;
const HINT_H = 24;
const ICON = 36;
const RIGHT_W = COL_W * 3 + GAP * 2;
const TOTAL_W = CARD_W + GAP + RIGHT_W;
const NOTE_H = 76;
const NOTE_GAP = 12;
const SECTION_H = PAD + HEADER_H + HINT_H + 14 + 3 * NOTE_H + 2 * NOTE_GAP + PAD;
const MIDDLE_H = 244;
const HELP_H = 190;
const BODY_H = SECTION_H + GAP + MIDDLE_H + GAP + HELP_H;
const TITLE_H = 52;
const SUBTITLE_H = 30;
const HEAD_GAP = 28;

// A panel: the tinted card, its deep-hue header, a glyph top-right and a
// muted prompt under the header. Returns the y where its body starts.
function panel(
  out: Element[],
  x: number,
  y: number,
  w: number,
  h: number,
  p: { label: string; hint: string; icon: string; fill: string; stroke: string; header: string },
): number {
  out.push(
    {
      ...createShape('square', x, y),
      width: w,
      height: h,
      fillColor: p.fill,
      strokeColor: p.stroke,
      borderRadius: 'md',
      themeLockFill: true,
      ...scaffold,
    },
    {
      ...createText(x + PAD, y + PAD),
      width: w - PAD * 2 - ICON,
      height: HEADER_H,
      label: p.label,
      textSize: 'lg',
      textAlignX: 'left',
      textColor: p.header,
      ...scaffold,
    },
    {
      ...createShape('icon', x + w - PAD - ICON, y + PAD + (HEADER_H - ICON) / 2),
      width: ICON,
      height: ICON,
      iconId: p.icon,
      strokeColor: p.header,
      ...scaffold,
    },
    {
      ...createText(x + PAD, y + PAD + HEADER_H),
      width: w - PAD * 2,
      height: HINT_H,
      label: p.hint,
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...scaffold,
    },
  );
  return y + PAD + HEADER_H + HINT_H + 14;
}

// Personality: two columns of spectrums, each a pair of poles over a bar
// filled towards the pole she leans to.
function personality(out: Element[], x: number, y: number): void {
  const w = COL_W * 2 + GAP;
  const bodyY = panel(out, x, y, w, MIDDLE_H, {
    label: 'Personality',
    hint: 'Where she sits between two poles',
    icon: 'sliders',
    fill: '#f5f3ff',
    stroke: '#c4b5fd',
    header: '#6d28d9',
  });
  const colGap = 36;
  const cellW = (w - PAD * 2 - colGap) / 2;
  const labelH = 24;
  const barH = 26;
  const rowPitch = labelH + 6 + barH + 22;
  PERSONA_SPECTRUMS.forEach((s, i) => {
    const sx = x + PAD + (i % 2) * (cellW + colGap);
    const sy = bodyY + Math.floor(i / 2) * rowPitch;
    const pole = (label: string, alignX: 'left' | 'right') => ({
      ...createText(sx + (alignX === 'left' ? 0 : cellW / 2), sy),
      width: cellW / 2,
      height: labelH,
      label,
      textSize: 'sm' as const,
      textColor: '#4c1d95',
      textAlignX: alignX,
      ...scaffold,
    });
    out.push(pole(s.left, 'left'), pole(s.right, 'right'), {
      ...createShape('progress-bar', sx, sy + labelH + 6),
      width: cellW,
      height: barH,
      progress: s.value,
      fillColor: '#ede9fe',
      strokeColor: '#a78bfa',
      textColor: '#2e1065',
      themeLockFill: true,
      ...content,
    });
  });
}

// Channels: where to reach her and how she responds there, then how at home
// she is with technology on a five-star scale.
function channels(out: Element[], x: number, y: number): void {
  const bodyY = panel(out, x, y, COL_W, MIDDLE_H, {
    label: 'Channels',
    hint: 'Where to reach her',
    icon: 'bell',
    fill: '#fffbeb',
    stroke: '#fcd34d',
    header: '#b45309',
  });
  const rowH = 30;
  const innerW = COL_W - PAD * 2;
  PERSONA_CHANNELS.forEach((c, i) => {
    const ry = bodyY + i * rowH;
    out.push(
      {
        ...createShape('icon', x + PAD, ry + 5),
        width: 20,
        height: 20,
        iconId: c.icon,
        strokeColor: '#b45309',
        ...scaffold,
      },
      {
        ...createText(x + PAD + 30, ry),
        width: innerW - 30,
        height: rowH,
        label: `${c.name} · ${c.note}`,
        textSize: 'sm',
        textColor: '#451a03',
        textAlignX: 'left',
        ...content,
      },
    );
  });
  const rateY = bodyY + PERSONA_CHANNELS.length * rowH + 6;
  out.push(
    {
      ...createText(x + PAD, rateY),
      width: 130,
      height: 36,
      label: 'Tech comfort',
      textSize: 'sm',
      textBold: true,
      textColor: '#451a03',
      textAlignX: 'left',
      ...scaffold,
    },
    {
      ...createShape('rating', x + COL_W - PAD - 176, rateY),
      width: 176,
      height: 36,
      rating: 4,
      strokeColor: '#f59e0b',
      ...content,
    },
  );
}

// How we help: the closing band, each need answered by what we build.
function howWeHelp(out: Element[], x: number, y: number): void {
  const deep = '#134e4a';
  out.push(
    {
      ...createShape('square', x, y),
      width: RIGHT_W,
      height: HELP_H,
      fillColor: deep,
      strokeColor: deep,
      borderRadius: 'md',
      themeLockFill: true,
      ...scaffold,
    },
    {
      ...createText(x + PAD, y + PAD),
      width: 400,
      height: HEADER_H,
      label: 'How we help',
      textSize: 'lg',
      textColor: '#ffffff',
      textAlignX: 'left',
      ...scaffold,
    },
    {
      ...createText(x + RIGHT_W - PAD - ICON - 12 - 420, y + PAD),
      width: 420,
      height: HEADER_H,
      label: 'The needs the reorder flow must meet',
      textSize: 'sm',
      textColor: '#99f6e4',
      textAlignX: 'right',
      ...scaffold,
    },
    {
      ...createShape('icon', x + RIGHT_W - PAD - ICON, y + PAD + (HEADER_H - ICON) / 2),
      width: ICON,
      height: ICON,
      iconId: 'heart',
      strokeColor: '#5eead4',
      ...scaffold,
    },
  );
  const itemW = (RIGHT_W - PAD * 2 - GAP * 2) / 3;
  const itemY = y + PAD + HEADER_H + 16;
  PERSONA_HELP.forEach((h, i) => {
    const ix = x + PAD + i * (itemW + GAP);
    const chip = 30;
    out.push(
      {
        ...createShape('circle', ix, itemY),
        width: chip,
        height: chip,
        label: `${i + 1}`,
        textSize: 'sm',
        textBold: true,
        fillColor: '#5eead4',
        strokeColor: '#5eead4',
        textColor: deep,
        themeLockFill: true,
        ...scaffold,
      },
      {
        ...createText(ix + chip + 12, itemY),
        width: itemW - chip - 12,
        height: chip,
        label: h.need,
        textSize: 'md',
        textBold: true,
        textColor: '#ffffff',
        textAlignX: 'left',
        ...content,
      },
      {
        ...createText(ix + chip + 12, itemY + chip + 6),
        width: itemW - chip - 12,
        height: 52,
        label: h.answer,
        textSize: 'sm',
        textColor: '#ccfbf1',
        textAlignX: 'left',
        textAlignY: 'top',
        ...content,
      },
    );
  });
}

export function buildUserPersona(cx: number, cy: number): Element[] {
  const totalH = TITLE_H + SUBTITLE_H + HEAD_GAP + BODY_H;
  const x0 = cx - TOTAL_W / 2;
  const y0 = cy - totalH / 2;
  const top = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;
  const out: Element[] = [
    {
      ...createText(x0, y0),
      width: TOTAL_W - 320,
      height: TITLE_H,
      label: 'User persona · Plateful',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(x0 + TOTAL_W - 320, y0),
      width: 320,
      height: TITLE_H,
      label: 'Reorder squad · v2',
      textSize: 'md',
      textColor: MUTED,
      textAlignX: 'right',
      ...content,
    },
    {
      ...createText(x0, y0 + TITLE_H),
      width: TOTAL_W,
      height: SUBTITLE_H,
      label:
        'Who we design for, built from research rather than guesses. Challenge it when the evidence changes.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...scaffold,
    },
  ];

  personaProfileCard(out, x0, top, BODY_H);

  const rx = x0 + CARD_W + GAP;
  PERSONA_SECTIONS.forEach((s, i) => {
    const sx = rx + i * (COL_W + GAP);
    const bodyY = panel(out, sx, top, COL_W, SECTION_H, s);
    s.notes.forEach((note, j) => {
      out.push({
        ...createSticky(sx + PAD, bodyY + j * (NOTE_H + NOTE_GAP)),
        width: COL_W - PAD * 2,
        height: NOTE_H,
        label: note,
        textSize: 'md',
        fillColor: s.sticky.fill,
        textColor: s.sticky.text,
        ...content,
      });
    });
  });

  const midY = top + SECTION_H + GAP;
  personality(out, rx, midY);
  channels(out, rx + (COL_W + GAP) * 2, midY);
  howWeHelp(out, rx, midY + MIDDLE_H + GAP);

  return out;
}
