// The approval workflow template builder (docs/specs/008-canvas/canvas-and-palette.md "Templates").
// Pure: (cx, cy) -> Element[], centred on (cx, cy). Re-exported from
// template-builders-flows with its process siblings.

import {
  createPinnedArrow,
  createShape,
  createText,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type ShapeKind,
} from '@livedesign/document';
import { liveFlowchart } from './template-flowchart-live';
import { swimlaneKey, type LaneHue } from './template-swimlane-kit';

const MUTED = '#64748b';
const INK = '#334155';

type Desk = LaneHue & { name: string; blurb: string; icon: string };
const DESKS: Desk[] = [
  {
    name: 'Requester',
    blurb: 'Asks for it',
    icon: 'user',
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
    band: '#ecfdf5',
    header: '#d1fae5',
    line: '#a7f3d0',
    node: '#10b981',
    tint: '#d1fae5',
    ink: '#065f46',
  },
];

// Approval workflow: a purchase request's two-stage sign-off (Northwind
// buying a designer a laptop), in three role COLUMNS: lane elements with a
// header band (docs/specs/009-elements/lane.md), each in its own hue with the
// role's glyph and what that desk asks, so everyone can see whose desk the
// request is on.
//
// It is a live flowchart (docs/specs/009-elements/flowchart.md "Templates") flowing down through the
// desks: Submit request → Manager review → Approved? → Finance check → In budget? → Purchase
// approved, each step in its desk's column, laid out by the flowchart layout so Tab and Enter grow
// it. The two gates reject DIFFERENTLY, the way real approvals do: the manager's No goes back to the
// requester's own column (Revise request, which loops back into Submit, so a rejection visibly costs a
// rework pass), while Finance's No is final (Declined). Exception steps are dashed. A chip beside each
// review's corner says how long it usually waits, which is the question every requester asks.
export function buildApprovalWorkflow(cx: number, cy: number): Element[] {
  const w = 160;
  const h = 64;
  const dW = 160;
  const dH = 96;
  const bandH = 56;
  const blurbH = 28;
  const titleH = 44;
  const captionH = 28;
  const headGap = 24;
  const keyGap = 28;
  const keyH = 28;

  // Seed positions: a column per desk, a row per step. They fix the order the layout reads.
  const seedColW = 240;
  const lanes: ShapeElement[] = DESKS.map((d, i) => ({
    ...createShape('lane', i * seedColW, 0),
    width: seedColW,
    height: 900,
    label: d.name,
    textSize: 'md',
    textBold: true,
    textColor: d.ink,
    textAlignX: 'center',
    textAlignY: 'top',
    fillColor: d.band,
    strokeColor: d.line,
    headerFill: d.header,
    // The band holds the desk's name and, under it, what the desk asks.
    headerSize: bandH + blurbH,
  }));

  const step = (
    label: string,
    desk: number,
    row: number,
    kind: ShapeKind = 'square',
    look: Partial<ShapeElement> = {},
  ): ShapeElement => ({
    ...createShape(kind, desk * seedColW + 40, 120 + row * 120),
    width: w,
    height: h,
    label,
    textSize: 'sm',
    fillColor: '#ffffff',
    strokeColor: DESKS[desk]!.node,
    textColor: INK,
    flowLaneId: lanes[desk]!.id,
    ...look,
  });
  const gate = (label: string, desk: number, row: number): ShapeElement =>
    step(label, desk, row, 'diamond', {
      width: dW,
      height: dH,
      fillColor: DESKS[desk]!.tint,
    });
  // The entry is the one filled step; the happy ending its soft echo.
  const submit = step('Submit request', 0, 0, 'stadium', {
    fillColor: DESKS[0]!.node,
    strokeColor: '#7e22ce',
    textColor: '#ffffff',
    textBold: true,
  });
  const review = step('Manager review', 1, 1);
  const approved = gate('Approved?', 1, 2);
  const check = step('Finance check', 2, 3);
  const inBudget = gate('In budget?', 2, 4);
  const done = step('Purchase approved', 2, 5, 'stadium', { fillColor: DESKS[2]!.tint });
  // Exception paths, dashed. The rework lands back on the requester's desk.
  const revise = step('Revise request', 0, 3, 'square', { strokeStyle: 'dashed' });
  const declined = step('Declined', 2, 5, 'stadium', {
    x: 2 * seedColW + 200,
    strokeStyle: 'dashed',
  });
  const steps = [submit, review, approved, check, inBudget, done, revise, declined];

  const link = (
    from: ShapeElement,
    to: ShapeElement,
    extra: Partial<ArrowElement> = {},
  ): ArrowElement => ({
    ...createPinnedArrow(from.id, 's', to.id, 'n'),
    arrowStyle: 'angled',
    ...extra,
  });
  const onDesk = (desk: number) => ({ textColor: DESKS[desk]!.ink, labelFill: DESKS[desk]!.band });
  const connectors: ArrowElement[] = [
    link(submit, review),
    link(review, approved),
    link(approved, check, { label: 'Yes', ...onDesk(1) }),
    link(check, inBudget),
    link(inBudget, done, { label: 'Yes', ...onDesk(2) }),
    // The manager's No goes back to the requester's own desk.
    link(approved, revise, { label: 'No', ...onDesk(1) }),
    link(revise, submit, { label: 'Resubmit', ...onDesk(0) }),
    link(inBudget, declined, { label: 'No', ...onDesk(2) }),
  ];

  // Laid out once to learn its size, then placed so the whole composition centres on (cx, cy).
  const probe = liveFlowchart(steps, connectors, {
    direction: 'down',
    lanes,
    left: 0,
    top: 0,
  }).bounds;
  const totalW = probe.width;
  const totalH = titleH + captionH + headGap + probe.height + keyGap + keyH;
  const left = Math.round(cx - totalW / 2);
  const top = Math.round(cy - totalH / 2);
  const laneTopY = top + titleH + captionH + headGap;
  const chart = liveFlowchart(steps, connectors, {
    direction: 'down',
    lanes,
    left,
    top: laneTopY,
  });
  const laid = (el: ShapeElement) => chart.elements.find((e) => e.id === el.id) as ShapeElement;

  const els: Element[] = [
    {
      ...createText(left, top),
      width: Math.max(totalW, 640),
      height: titleH,
      label: 'Northwind · a £1,800 laptop for a new designer',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: Math.max(totalW, 640),
      height: captionH,
      label:
        "One column per desk. The manager's No sends it back for changes; Finance's No is final. Chips show the usual wait.",
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
  // Each desk's band: the role's glyph just left of its centred name (names are short, so ~12px a
  // character at md bold places it), and what the desk asks under it.
  const bands: Element[] = DESKS.flatMap((d, i) => {
    const lane = laid(lanes[i]!);
    return [
      {
        ...createShape(
          'icon',
          lane.x + lane.width / 2 - (d.name.length * 12) / 2 - 32,
          lane.y + 17,
        ),
        width: 22,
        height: 22,
        iconId: d.icon,
        strokeColor: d.ink,
      },
      {
        ...createText(lane.x, lane.y + bandH - 10),
        width: lane.width,
        height: blurbH,
        label: d.blurb,
        textSize: 'sm' as const,
        textColor: MUTED,
        textAlignX: 'center' as const,
      },
    ];
  });

  // How long each review usually waits, as a chip on its top-right corner, clear of the connectors.
  const chip = (label: string, of: ShapeElement, desk: number) => {
    const at = laid(of);
    const d = DESKS[desk]!;
    return {
      ...createShape('stadium', at.x + at.width - 52, at.y - 13),
      width: 112,
      height: 26,
      label,
      textSize: 'sm' as const,
      fillColor: d.tint,
      strokeColor: d.line,
      textColor: d.ink,
    };
  };

  const keyY = laneTopY + probe.height + keyGap;
  return [
    ...els,
    ...chart.elements,
    ...bands,
    chip('Usually 1 day', review, 1),
    chip('Usually 3 days', check, 2),
    ...swimlaneKey(left, keyY, keyH),
  ];
}
