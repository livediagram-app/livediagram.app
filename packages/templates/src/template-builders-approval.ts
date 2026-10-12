// The approval workflow template builder (docs/specs/008-canvas/canvas-and-palette.md "Templates").
// Pure: (cx, cy) -> Element[], centred on (cx, cy). Re-exported from
// template-builders-flows with its process siblings.

import {
  createPinnedArrow,
  createShape,
  createText,
  type Anchor,
  type Element,
  type ShapeKind,
} from '@livediagram/document';
import { swimlaneKey, type LaneHue } from './template-swimlane-kit';

const MUTED = '#64748b';
const INK = '#334155';

type Desk = LaneHue & { name: string; blurb: string; icon: string; from: number; to: number };
const DESKS: Desk[] = [
  {
    name: 'Requester',
    blurb: 'Asks for it',
    icon: 'user',
    from: 0,
    to: 0,
    band: '#faf5ff',
    header: '#f3e8ff',
    line: '#d8b4fe',
    node: '#a855f7',
    tint: '#f3e8ff',
    ink: '#6b21a8',
  },
  {
    name: 'Manager',
    blurb: 'Is it needed?',
    icon: 'user-check',
    from: 1,
    to: 2,
    band: '#f0f9ff',
    header: '#e0f2fe',
    line: '#bae6fd',
    node: '#0ea5e9',
    tint: '#e0f2fe',
    ink: '#075985',
  },
  {
    name: 'Finance',
    blurb: 'Can we afford it?',
    icon: 'dollar-sign',
    from: 3,
    to: 5,
    band: '#ecfdf5',
    header: '#d1fae5',
    line: '#a7f3d0',
    node: '#10b981',
    tint: '#d1fae5',
    ink: '#065f46',
  },
];

// Approval workflow: a purchase request's two-stage sign-off (Northwind
// buying a designer a laptop), laid out in three role COLUMNS: lane elements
// pinned top-centre so their gutter becomes a header band
// (docs/specs/009-elements/lane.md), each in its own hue with the role's glyph
// and what that desk asks, so everyone can see whose desk the request is on.
//
// The main row reads left to right: Submit request → Manager review →
// Approved? → Finance check → In budget? → Purchase approved. The two gates
// reject DIFFERENTLY, the way real approvals do: the manager's No goes back
// to the requester's own column (Revise request, which climbs back into
// Submit, so a rejection visibly costs a rework pass), while Finance's No is
// final (Declined). Exception steps are dashed. A chip under each review
// says how long it usually waits, which is the question every requester
// asks. The columns stand apart with a gap, so a label on a line that
// crosses from one desk to the next sits in open canvas, never on a border.
export function buildApprovalWorkflow(cx: number, cy: number): Element[] {
  const colW = 236;
  const w = 160;
  const h = 64;
  const dW = 160;
  const dH = 96;
  const laneGap = 40;
  const bandH = 56;
  const blurbH = 28;
  const titleH = 44;
  const captionH = 28;
  const headGap = 24;
  const keyGap = 28;
  const keyH = 28;
  // Main row, then the exception row under it.
  const rowDrop = 64;
  const lowDrop = 176;
  const laneH = bandH + blurbH + rowDrop + dH / 2 + lowDrop - dH / 2 + h / 2 + 40;
  const totalW = 6 * colW - laneGap;
  const totalH = titleH + captionH + headGap + laneH + keyGap + keyH;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;
  const laneTopY = top + titleH + captionH + headGap;
  const rowY = laneTopY + bandH + blurbH + rowDrop;
  const lowY = rowY + lowDrop;
  const colX = (col: number) => left + col * colW + (colW - laneGap) / 2;

  const els: Element[] = [
    {
      ...createText(left, top),
      width: totalW,
      height: titleH,
      label: 'Northwind · a £1,800 laptop for a new designer',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: totalW,
      height: captionH,
      label:
        "One column per desk. The manager's No sends it back for changes; Finance's No is final. Chips show the usual wait.",
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
  for (const d of DESKS) {
    const x = left + d.from * colW;
    const width = (d.to - d.from + 1) * colW - laneGap;
    els.push(
      {
        ...createShape('lane', x, laneTopY),
        width,
        height: laneH,
        label: d.name,
        textSize: 'md',
        textBold: true,
        textColor: d.ink,
        textAlignX: 'center',
        textAlignY: 'top',
        fillColor: d.band,
        strokeColor: d.line,
        headerFill: d.header,
        headerSize: bandH,
      },
      // The role's glyph just left of its centred title (titles are short,
      // so ~12px a character at md bold places it).
      {
        ...createShape('icon', x + width / 2 - (d.name.length * 12) / 2 - 32, laneTopY + 27),
        width: 22,
        height: 22,
        iconId: d.icon,
        strokeColor: d.ink,
      },
      {
        ...createText(x, laneTopY + bandH + 8),
        width,
        height: blurbH,
        label: d.blurb,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'center',
      },
    );
  }

  type Step = Extract<Element, { type: 'shape' }>;
  const deskOf = (col: number) => DESKS.find((d) => col >= d.from && col <= d.to)!;
  const step = (
    label: string,
    col: number,
    y: number,
    kind: ShapeKind = 'square',
    look: Partial<Step> = {},
  ): Step => ({
    ...createShape(kind, colX(col) - w / 2, y - h / 2),
    width: w,
    height: h,
    label,
    textSize: 'sm',
    fillColor: '#ffffff',
    strokeColor: deskOf(col).node,
    textColor: INK,
    ...look,
  });
  const gate = (label: string, col: number): Step =>
    step(label, col, rowY, 'diamond', {
      x: colX(col) - dW / 2,
      y: rowY - dH / 2,
      width: dW,
      height: dH,
      fillColor: deskOf(col).tint,
    });
  // The entry is the one filled step; the happy ending its soft echo.
  const submit = step('Submit request', 0, rowY, 'stadium', {
    fillColor: DESKS[0]!.node,
    strokeColor: '#7e22ce',
    textColor: '#ffffff',
    textBold: true,
  });
  const review = step('Manager review', 1, rowY);
  const approved = gate('Approved?', 2);
  const check = step('Finance check', 3, rowY);
  const inBudget = gate('In budget?', 4);
  const done = step('Purchase approved', 5, rowY, 'stadium', { fillColor: DESKS[2]!.tint });
  // Exception paths, dashed. The rework lands back on the requester's desk.
  const revise = step('Revise request', 0, lowY, 'square', { strokeStyle: 'dashed' });
  const declined = step('Declined', 4, lowY, 'stadium', { strokeStyle: 'dashed' });

  // How long each review usually waits, as a chip just under it.
  const chip = (label: string, col: number) => {
    const d = deskOf(col);
    return {
      ...createShape('stadium', colX(col) - 56, rowY + h / 2 + 12),
      width: 112,
      height: 26,
      label,
      textSize: 'sm' as const,
      fillColor: d.tint,
      strokeColor: d.line,
      textColor: d.ink,
    };
  };

  const link = (
    from: Step,
    fa: Anchor,
    to: Step,
    ta: Anchor,
    extra: Partial<Extract<Element, { type: 'arrow' }>> = {},
  ): Element => ({ ...createPinnedArrow(from.id, fa, to.id, ta), ...extra });
  const onDesk = (col: number) => ({ textColor: deskOf(col).ink, labelFill: deskOf(col).band });
  const arrows: Element[] = [
    link(submit, 'e', review, 'w'),
    link(review, 'e', approved, 'w'),
    // The Yes crosses from one desk to the next; its label sits in the gap.
    link(approved, 'e', check, 'w', { label: 'Yes' }),
    link(check, 'e', inBudget, 'w'),
    link(inBudget, 'e', done, 'w', { label: 'Yes', ...onDesk(4) }),
    // The manager's No: down out of the gate, then back across to the
    // requester's column. Its label rides the drop, inside the manager's desk.
    link(approved, 's', revise, 'e', {
      arrowStyle: 'angled',
      label: 'No',
      ...onDesk(2),
      labelOffset: { t: 0.12, offset: -16 },
    }),
    link(revise, 'n', submit, 's', { label: 'Resubmit', ...onDesk(0) }),
    link(inBudget, 's', declined, 'n', { label: 'No', ...onDesk(4) }),
  ];

  const keyY = laneTopY + laneH + keyGap;
  els.push(...swimlaneKey(left, keyY, keyH));

  return [
    ...els,
    ...arrows,
    submit,
    review,
    approved,
    check,
    inBudget,
    done,
    revise,
    declined,
    chip('Usually 1 day', 1),
    chip('Usually 3 days', 3),
  ];
}
