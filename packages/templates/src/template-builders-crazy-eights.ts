// The Crazy 8s template (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): the design-sprint sketching exercise, ready to run for one
// Plateful prompt, "How might we make reordering a favourite meal take two
// taps?".
//
// A left rail runs the session in the order it happens: the prompt card, the
// two session tools (an 8-minute timer and a 3-dot vote), the four steps
// (fold, sketch, present, vote) and a done check so the facilitator sees who
// has finished. The sheet is a sheet of paper folded into eight: numbered
// panels in two rows of four, each captioned with its minute. The first three
// hold quick low-fidelity sketches (template-crazy-eights-sketches.ts), with
// numbered tap markers counting the two taps; the other five are empty, each
// with a faint nudge towards a stranger idea. A muted line under the sheet
// invites everyone to duplicate it for themselves. The paper, panels, chips,
// steps and guidance are the "Sheet" scaffold; the prompt, tools, name,
// sketches and hints ride "Sketches".
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createText, type Element } from '@livediagram/document';
import {
  FAINT,
  HAND,
  INK,
  PANEL_HINTS,
  PAPER,
  SKETCHES,
  panelHint,
} from './template-crazy-eights-sketches';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

const MUTED = '#64748b';
const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };

const RAIL_W = 320;
const GAP = 40;
const PANEL_W = 250;
const PANEL_H = 340;
// The gap between panels: the fold creases of the paper.
const CREASE = 18;
const SHEET_PAD = 28;
const SHEET_HEAD = 56;
const SHEET_W = SHEET_PAD * 2 + PANEL_W * 4 + CREASE * 3;
const SHEET_H = SHEET_PAD + SHEET_HEAD + PANEL_H * 2 + CREASE + SHEET_PAD;
const TOTAL_W = RAIL_W + GAP + SHEET_W;
const TITLE_H = 52;
const SUBTITLE_H = 30;
const HEAD_GAP = 28;
const INVITE_GAP = 16;
const INVITE_H = 30;

// The ritual, one line each: what to do, then the rule that makes it work.
const STEPS: { title: string; detail: string }[] = [
  { title: 'Fold', detail: 'A sheet into eight panels' },
  { title: 'Sketch', detail: 'One idea a minute, no erasing' },
  { title: 'Present', detail: 'Thirty seconds each, no pitching' },
  { title: 'Vote', detail: 'Three dots on the strongest' },
];

// The opening rail: prompt, tools, steps, done check.
function rail(out: Element[], x: number, top: number): void {
  // The prompt card: an eyebrow over the question, in the brand's warm paper.
  const promptH = 196;
  out.push(
    {
      ...createShape('square', x, top),
      width: RAIL_W,
      height: promptH,
      fillColor: '#fff7ed',
      strokeColor: '#fdba74',
      strokeWidth: 'thick',
      borderRadius: 'lg',
      themeLockFill: true,
      ...scaffold,
    },
    {
      ...createText(x + 22, top + 18),
      width: RAIL_W - 44,
      height: 26,
      label: 'HOW MIGHT WE',
      textSize: 'sm',
      textBold: true,
      textColor: '#c2410c',
      textAlignX: 'left',
      ...scaffold,
    },
    {
      ...createText(x + 22, top + 46),
      width: RAIL_W - 44,
      height: promptH - 46 - 18,
      label: 'make reordering a favourite meal take two taps?',
      textSize: 'lg',
      textBold: true,
      textColor: '#1c1917',
      textAlignX: 'left',
      textAlignY: 'top',
      ...content,
    },
    {
      ...createShape('sticker', x + RAIL_W - 58, top - 22),
      width: 72,
      height: 72,
      stickerId: 'emoji-bulb',
      rotation: 8,
      ...content,
    },
  );

  // The two tools the exercise needs: eight minutes on the clock, then the
  // dot vote once everyone has presented.
  const toolsY = top + promptH + 20;
  const buttonW = (RAIL_W - 16) / 2;
  out.push(
    {
      ...createShape('session-button', x, toolsY),
      width: buttonW,
      height: 96,
      session: { tool: 'timer', minutes: 8 },
      ...content,
    },
    {
      ...createShape('session-button', x + buttonW + 16, toolsY),
      width: buttonW,
      height: 96,
      session: { tool: 'vote', dots: 3 },
      ...content,
    },
  );

  // The four steps, numbered in the ritual's order.
  const stepsY = toolsY + 96 + 24;
  out.push({
    ...createText(x, stepsY),
    width: RAIL_W,
    height: 32,
    label: 'How it runs',
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    ...scaffold,
  });
  const stepH = 50;
  const chip = 28;
  STEPS.forEach((step, i) => {
    const sy = stepsY + 40 + i * stepH;
    out.push(
      {
        ...createShape('circle', x, sy + 2),
        width: chip,
        height: chip,
        label: `${i + 1}`,
        textSize: 'sm',
        textBold: true,
        colorPreset: 'bold',
        ...scaffold,
      },
      {
        ...createText(x + chip + 14, sy),
        width: RAIL_W - chip - 14,
        height: 22,
        label: step.title,
        textSize: 'sm',
        textBold: true,
        textAlignX: 'left',
        ...scaffold,
      },
      {
        ...createText(x + chip + 14, sy + 21),
        width: RAIL_W - chip - 14,
        height: 22,
        label: step.detail,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
        ...scaffold,
      },
    );
  });

  // Who is still drawing: the done check sits at the foot of the rail.
  const doneY = top + SHEET_H - 220;
  out.push({
    ...createShape('done-check', x, doneY),
    width: RAIL_W,
    height: 220,
    label: 'Finished sketching?',
    ...content,
  });
}

// One panel of the folded sheet: its outline, the number chip on its corner
// and its minute, top-right.
function panelChrome(out: Element[], px: number, py: number, n: number): void {
  const chip = 32;
  out.push(
    {
      ...createShape('frame', px, py),
      width: PANEL_W,
      height: PANEL_H,
      label: `Minute ${n}`,
      textSize: 'sm',
      textColor: MUTED,
      strokeColor: FAINT,
      strokeStyle: 'dashed',
      ...scaffold,
    },
    {
      ...createShape('circle', px + 12, py + 12),
      width: chip,
      height: chip,
      label: `${n}`,
      textSize: 'sm',
      textBold: true,
      fillColor: INK,
      strokeColor: INK,
      textColor: '#ffffff',
      themeLockFill: true,
      ...scaffold,
    },
  );
}

export function buildCrazyEights(cx: number, cy: number): Element[] {
  const totalH = TITLE_H + SUBTITLE_H + HEAD_GAP + SHEET_H + INVITE_GAP + INVITE_H;
  const x0 = cx - TOTAL_W / 2;
  const y0 = cy - totalH / 2;
  const top = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;
  const out: Element[] = [
    {
      ...createText(x0, y0),
      width: TOTAL_W - 280,
      height: TITLE_H,
      label: 'Crazy 8s · Two-tap reorder',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(x0 + TOTAL_W - 280, y0),
      width: 280,
      height: TITLE_H,
      label: '8 ideas · 8 minutes',
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
        'Fold, then sketch one idea a minute until the timer ends. Quantity beats polish: rough is the point.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...scaffold,
    },
  ];

  rail(out, x0, top);

  // The sheet: one piece of paper, lifted off the canvas by a soft shadow.
  // It is a frame, so dragging it carries every panel and sketch with it.
  const sx = x0 + RAIL_W + GAP;
  out.push({
    ...createShape('frame', sx, top),
    width: SHEET_W,
    height: SHEET_H,
    label: '',
    fillColor: PAPER,
    strokeColor: '#e2e8f0',
    strokeStyle: 'solid',
    borderRadius: 'md',
    themeLockFill: true,
    shadow: { offsetX: 0, offsetY: 8, blur: 24, opacity: 0.14 },
    ...scaffold,
  });
  // Whose sheet, and how far they have got.
  out.push(
    {
      ...createText(sx + SHEET_PAD, top + SHEET_PAD - 6),
      width: 400,
      height: SHEET_HEAD - 8,
      label: 'Ana’s sheet',
      font: HAND,
      textSize: 'lg',
      textBold: true,
      textColor: INK,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(sx + SHEET_W - SHEET_PAD - 64 - 300, top + SHEET_PAD - 6),
      width: 300,
      height: SHEET_HEAD - 8,
      label: '3 of 8 sketched',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'right',
      ...content,
    },
  );

  // A pencil tossed on the corner of the paper.
  out.push({
    ...createShape('sticker', sx + SHEET_W - 58, top - 26),
    width: 76,
    height: 76,
    stickerId: 'emoji-pencil',
    rotation: -10,
    ...content,
  });

  const panelsY = top + SHEET_PAD + SHEET_HEAD;
  for (let i = 0; i < 8; i++) {
    const px = sx + SHEET_PAD + (i % 4) * (PANEL_W + CREASE);
    const py = panelsY + Math.floor(i / 4) * (PANEL_H + CREASE);
    panelChrome(out, px, py, i + 1);
    // The drawing area sits under the chip row, above the caption.
    const drawY = py + 50;
    const sketch = SKETCHES[i];
    if (sketch) {
      out.push(...sketch.draw(px, drawY), {
        ...createText(px + 12, py + PANEL_H - 44),
        width: PANEL_W - 24,
        height: 34,
        label: sketch.caption,
        font: HAND,
        textSize: 'md',
        textBold: true,
        textColor: INK,
        textAlignX: 'center',
        ...content,
      });
    } else {
      out.push(...panelHint(px, drawY, PANEL_W, PANEL_H - 50, PANEL_HINTS[i - SKETCHES.length]!));
    }
  }

  // The invitation to make it everyone's: duplicate the sheet per person.
  const inviteY = top + SHEET_H + INVITE_GAP;
  out.push(
    {
      ...createShape('icon', sx, inviteY + 5),
      width: 20,
      height: 20,
      iconId: 'copy',
      strokeColor: MUTED,
      ...scaffold,
    },
    {
      ...createText(sx + 30, inviteY),
      width: SHEET_W - 30,
      height: INVITE_H,
      label:
        'Sketching as a team? Everyone takes a copy: select the sheet, duplicate it (Cmd or Ctrl + D) and write your name on it.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...scaffold,
    },
  );

  return out;
}
