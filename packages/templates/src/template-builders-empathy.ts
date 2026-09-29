// The empathy map builder, split out of template-builders-canvases.ts (which
// re-exports it) once the persona card and Pains / Gains strip outgrew a
// shared file. Pure: (cx, cy) -> Element[]. See
// docs/specs/008-canvas/canvas-and-palette.md "Templates".

import {
  createShape,
  createSticky,
  createText,
  runsPlainText,
  type Element,
  type TextRun,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// Empathy map: a persona card over Says / Thinks / Does / Feels quadrants,
// with the Pains / Gains strip the modern canvas adds beneath. Same bones as
// the SWOT (tinted containers, a header in a deeper hue, a role glyph
// top-right) but the starters are sticky notes in the quadrant's own hue,
// because empathy-map input is verbatim research capture rather than
// analysis bullets. The persona sits ABOVE the grid rather than in its
// cross-gap: the centred circle it used to be covered the "Feels" header and
// the "Does" glyph.
type EmpathyBlock = {
  label: string;
  fill: string;
  stroke: string;
  headerColor: string;
  icon: string;
  // A STICKY_PRESETS paper + ink pair, so a note reads as belonging to its
  // block and the pad colours stay the user's own shorthand.
  sticky: { fill: string; text: string };
  notes: [string, string];
};

const EMPATHY_QUADRANTS: EmpathyBlock[] = [
  {
    label: 'Says',
    fill: '#dbeafe',
    stroke: '#93c5fd',
    headerColor: '#1d4ed8',
    icon: 'message',
    sticky: { fill: '#bae6fd', text: '#082f49' },
    notes: ['"I need everyone on the same page"', '"Our docs are scattered everywhere"'],
  },
  {
    label: 'Thinks',
    fill: '#ede9fe',
    stroke: '#c4b5fd',
    headerColor: '#6d28d9',
    icon: 'help-circle',
    sticky: { fill: '#e9d5ff', text: '#3b0764' },
    notes: ['Will the team actually adopt another tool?', 'I should look prepared in reviews'],
  },
  {
    label: 'Does',
    fill: '#dcfce7',
    stroke: '#86efac',
    headerColor: '#15803d',
    icon: 'activity',
    sticky: { fill: '#bbf7d0', text: '#052e16' },
    notes: ['Sketches plans on paper first', 'Pastes screenshots into chat threads'],
  },
  {
    label: 'Feels',
    fill: '#ffe4e6',
    stroke: '#fda4af',
    headerColor: '#be123c',
    icon: 'heart',
    sticky: { fill: '#fecdd3', text: '#4c0519' },
    notes: ['Overwhelmed by back-to-back meetings', 'Proud when the team ships together'],
  },
];
const EMPATHY_STRIP: EmpathyBlock[] = [
  {
    label: 'Pains',
    fill: '#ffedd5',
    stroke: '#fdba74',
    headerColor: '#c2410c',
    icon: 'alert-triangle',
    sticky: { fill: '#fed7aa', text: '#431407' },
    notes: ['Plans drift out of date within a week', 'Chasing six people for one decision'],
  },
  {
    label: 'Gains',
    fill: '#ccfbf1',
    stroke: '#5eead4',
    headerColor: '#0f766e',
    icon: 'trending-up',
    sticky: { fill: '#99f6e4', text: '#042f2e' },
    notes: ['One board the whole team trusts', 'Decisions made in the room, not after it'],
  },
];

export function buildEmpathyMap(cx: number, cy: number): Element[] {
  const cellW = 560;
  const gap = 28;
  const pad = 20;
  const headerH = 56;
  const iconSize = 48;
  const stickyH = 110;
  const stickyGap = 16;
  const totalW = cellW * 2 + gap;
  const personaH = 132;
  // Quadrant: header, then two stacked notes. Strip block: header, then two
  // notes side by side, so the strip reads as a lighter band under the grid.
  const quadH = pad + headerH + stickyGap + stickyH * 2 + stickyGap + pad;
  const stripH = pad + headerH + stickyGap + stickyH + pad;
  const totalH = personaH + gap + quadH * 2 + gap + gap * 2 + stripH;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;

  const elements: Element[] = [];

  // Persona card: who every block describes, with the goal the research is
  // in service of. The card is scaffold; the name and goal ride the content
  // layer so they stay editable when the scaffold is locked.
  elements.push({
    ...createShape('square', left, top),
    width: totalW,
    height: personaH,
    fillColor: '#f8fafc',
    strokeColor: '#cbd5e1',
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });
  const stickerSize = 92;
  elements.push({
    ...createShape('sticker', left + pad + 4, top + (personaH - stickerSize) / 2),
    width: stickerSize,
    height: stickerSize,
    stickerId: 'emoji-person',
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });
  const textX = left + pad + stickerSize + 28;
  const textW = totalW - (textX - left) - pad;
  elements.push({
    ...createText(textX, top + 22),
    width: textW,
    height: 44,
    label: 'Priya · Team lead at a 40-person startup',
    textSize: 'lg',
    textBold: true,
    textAlignX: 'left',
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });
  const goalRuns: TextRun[] = [
    { text: 'Needs to ', bold: true },
    { text: 'get six people planning from one shared picture, without another tool to babysit.' },
  ];
  elements.push({
    ...createText(textX, top + 70),
    width: textW,
    height: 40,
    label: runsPlainText(goalRuns),
    richText: goalRuns,
    textSize: 'sm',
    textColor: '#475569',
    textAlignX: 'left',
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });

  const block = (b: EmpathyBlock, x: number, y: number, h: number, sideBySide: boolean) => {
    elements.push({
      ...createShape('square', x, y),
      width: cellW,
      height: h,
      fillColor: b.fill,
      strokeColor: b.stroke,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    elements.push({
      ...createText(x + pad, y + pad),
      width: cellW - pad * 2 - iconSize,
      height: headerH,
      label: b.label,
      textSize: 'lg',
      textAlignX: 'left',
      textColor: b.headerColor,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    elements.push({
      ...createShape('icon', x + cellW - pad - iconSize, y + pad + (headerH - iconSize) / 2),
      width: iconSize,
      height: iconSize,
      iconId: b.icon,
      strokeColor: b.headerColor,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    const noteTop = y + pad + headerH + stickyGap;
    const noteW = sideBySide ? (cellW - pad * 2 - stickyGap) / 2 : cellW - pad * 2;
    b.notes.forEach((note, i) => {
      elements.push({
        ...createSticky(
          x + pad + (sideBySide ? i * (noteW + stickyGap) : 0),
          noteTop + (sideBySide ? 0 : i * (stickyH + stickyGap)),
        ),
        width: noteW,
        height: stickyH,
        label: note,
        textSize: 'sm',
        fillColor: b.sticky.fill,
        textColor: b.sticky.text,
        layerId: TEMPLATE_CONTENT_LAYER_ID,
      });
    });
  };

  const gridTop = top + personaH + gap;
  EMPATHY_QUADRANTS.forEach((q, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    block(q, left + col * (cellW + gap), gridTop + row * (quadH + gap), quadH, false);
  });
  // A double gap sets the strip apart from the quadrants: it is the
  // synthesis of what the four blocks above observed.
  const stripTop = gridTop + quadH * 2 + gap + gap * 2;
  EMPATHY_STRIP.forEach((b, i) => block(b, left + i * (cellW + gap), stripTop, stripH, true));

  return elements;
}
