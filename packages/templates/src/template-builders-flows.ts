import {
  createPinnedArrow,
  createShape,
  createText,
  type Element,
  type ShapeKind,
} from '@livediagram/document';

// Process-style template builders (swimlane, decision tree, approval
// workflow). Split out of template-builders.ts; each is pure
// (cx, cy) -> Element[]. The data-flow diagram lives in
// ./template-builders-dataflow and the decision tree in
// ./template-builders-decision-tree (re-exported here). See
// docs/specs/008-canvas/canvas-and-palette.md.
export { buildDecisionTree } from './template-builders-decision-tree';

export function buildBlank(): Element[] {
  return [];
}

// Swimlane flowchart (docs/specs/008-canvas/canvas-and-palette.md): an order's journey from click to
// doorstep across four role lanes (Customer / Sales / Warehouse / Courier).
//
// The lanes are LANE elements (docs/specs/009-elements/lane.md), so each role is the lane's own label
// in its built-in title gutter. Every step sits on a shared column grid, one
// column per step, so each hand-off is either a straight run inside a lane
// or an angled (elbow) run that drops or climbs through EMPTY columns: no
// diagonal cuts across a lane and no arrow passes behind a step.
//
// The flow demonstrates every swimlane idiom: hand-off (order to Sales),
// branch (In stock?), detour + rejoin (Restock back into Pick & pack) and
// notify (a tracking email up to the customer) and the round trip (the
// courier's delivery climbing back to the Customer lane).
export function buildSwimlane(cx: number, cy: number): Element[] {
  const roles = ['Customer', 'Sales', 'Warehouse', 'Courier'];
  // Wider than the lane's default 132px gutter so the longest role name
  // ("Warehouse" at md) sits inside it with air either side.
  const gutter = 160;
  const cols = 7;
  const colW = 180;
  const stepW = 150;
  const stepH = 64;
  const pad = 24;
  const laneW = gutter + pad * 2 + (cols - 1) * colW + stepW;
  const laneH = 124;
  // Lanes sit slightly apart: flush borders doubled into a heavier line with
  // a hairline sliver between, while a deliberate gap reads as bands.
  const laneGap = 12;
  const titleH = 48;
  const titleGap = 24;
  const lanesH = roles.length * laneH + (roles.length - 1) * laneGap;
  const left = cx - laneW / 2;
  const top = cy - (titleH + titleGap + lanesH) / 2;
  const top0 = top + titleH + titleGap;
  const laneTop = (i: number) => top0 + i * (laneH + laneGap);
  const title = {
    ...createText(left, top),
    width: laneW,
    height: titleH,
    label: 'Order fulfilment · from click to doorstep',
    textSize: 'lg' as const,
    textBold: true,
  };
  const lanes = roles.map((role, i) => ({
    ...createShape('lane', left, laneTop(i)),
    width: laneW,
    height: laneH,
    label: role,
    textSize: 'md' as const,
    headerSize: gutter,
  }));
  const colX = (col: number) => left + gutter + pad + stepW / 2 + col * colW;
  const laneCY = (i: number) => laneTop(i) + laneH / 2;
  const box = (label: string, col: number, lane: number, kind: ShapeKind = 'square') => ({
    ...createShape(kind, colX(col) - stepW / 2, laneCY(lane) - stepH / 2),
    width: stepW,
    height: stepH,
    label,
  });
  // Entry step of the process → strongest preset so the flow's start reads.
  const order = { ...box('Place order', 0, 0, 'stadium'), colorPreset: 'bold' };
  const check = box('Check order', 1, 1);
  const inStock = {
    ...createShape('diamond', colX(2) - 75, laneCY(1) - 45),
    width: 150,
    height: 90,
    label: 'In stock?',
    // The decision gate → a tint highlights the branch point.
    colorPreset: 'soft',
  };
  // The out-of-stock detour sits directly below the gate, then rejoins the
  // happy path at Pick & pack.
  const restock = {
    ...box('Restock item', 2, 2),
    // Exception path → outline preset (the state machine's Cancelled idiom).
    colorPreset: 'outline',
  };
  const pick = box('Pick & pack', 3, 2);
  const ship = box('Book courier', 4, 2);
  const deliver = box('Deliver parcel', 5, 3);
  const track = box('Track parcel', 4, 0);
  // The finish mirrors the start: a terminator back in the Customer lane.
  const received = { ...box('Order received', 6, 0, 'stadium'), colorPreset: 'soft' };
  const angled = 'angled' as const;
  const arrows = [
    // Down into Sales, then across into the review step.
    { ...createPinnedArrow(order.id, 's', check.id, 'w'), arrowStyle: angled },
    { ...createPinnedArrow(check.id, 'e', inStock.id, 'w') },
    { ...createPinnedArrow(inStock.id, 'e', pick.id, 'n'), arrowStyle: angled, label: 'Yes' },
    { ...createPinnedArrow(inStock.id, 's', restock.id, 'n'), label: 'No' },
    // The detour rejoins the happy path once stock lands.
    { ...createPinnedArrow(restock.id, 'e', pick.id, 'w') },
    { ...createPinnedArrow(pick.id, 'e', ship.id, 'w') },
    { ...createPinnedArrow(ship.id, 'e', deliver.id, 'n'), arrowStyle: angled },
    // The notification climbs straight up through Sales' empty column to
    // the customer, who follows the parcel until it lands. It crosses a
    // whole lane it has no endpoint in, and a lane counts as an obstacle for
    // passing behind boxes (docs/specs/008-canvas/arrow-route-behind.md), which would mask the line out
    // across that lane; `routeBehind: false` keeps it drawn over the band.
    {
      ...createPinnedArrow(ship.id, 'n', track.id, 's'),
      label: 'Tracking email',
      routeBehind: false,
    },
    { ...createPinnedArrow(track.id, 'e', received.id, 'w') },
    // The round trip: the delivery climbs back up through the empty last
    // column to the Customer lane the process started in (crossing two
    // lanes, so it opts out of passing behind them too).
    {
      ...createPinnedArrow(deliver.id, 'e', received.id, 's'),
      arrowStyle: angled,
      routeBehind: false,
    },
  ];
  return [
    title,
    ...lanes,
    ...arrows,
    order,
    check,
    inStock,
    restock,
    pick,
    ship,
    deliver,
    track,
    received,
  ];
}

// Approval workflow (docs/specs/008-canvas/canvas-and-palette.md): a purchase request's two-stage sign-off,
// laid out in three vertical role lanes (Requester / Manager / Finance) so
// everyone can see whose desk a request is on.
//
// The main row reads left to right: Submit request → Manager review →
// Approved? → Finance check → In budget? → Purchase approved. The two gates
// reject DIFFERENTLY, the way real approvals do: the manager's No sends it
// back for changes (Request changes loops into Submit, so a rejection
// visibly costs a rework pass), while Finance's No is final (Declined).
// Presets follow the house grammar: entry bold, gates soft, exception paths
// outlined (the state machine's Cancelled idiom), the happy ending soft.
export function buildApprovalWorkflow(cx: number, cy: number): Element[] {
  const colW = 250;
  const w = 164;
  const h = 64;
  const dW = 164;
  const dH = 100;
  const laneGap = 12;
  // A lane pinned top-centre turns its gutter into a header band, so the
  // lanes read as role COLUMNS (docs/specs/009-elements/lane.md).
  const bandH = 56;
  const rowY = cy - 30;
  const lowY = rowY + 170;
  const laneTopY = rowY - dH / 2 - 36 - bandH;
  const laneH = lowY + h / 2 + 36 - laneTopY;
  const x0 = cx - 2.5 * colW;
  const colX = (col: number) => x0 + col * colW;
  const roleLanes: { label: string; from: number; to: number }[] = [
    { label: 'Requester', from: 0, to: 0 },
    { label: 'Manager', from: 1, to: 2 },
    { label: 'Finance', from: 3, to: 5 },
  ];
  const lanes = roleLanes.map((r) => ({
    ...createShape('lane', colX(r.from) - colW / 2 + laneGap / 2, laneTopY),
    width: (r.to - r.from + 1) * colW - laneGap,
    height: laneH,
    label: r.label,
    textSize: 'md' as const,
    textAlignX: 'center' as const,
    textAlignY: 'top' as const,
    headerSize: bandH,
  }));
  const step = (label: string, col: number, y: number, kind: ShapeKind = 'square') => ({
    ...createShape(kind, colX(col) - w / 2, y - h / 2),
    width: w,
    height: h,
    label,
  });
  const gate = (label: string, col: number) => ({
    ...createShape('diamond', colX(col) - dW / 2, rowY - dH / 2),
    width: dW,
    height: dH,
    label,
    // The gates are the pivotal steps → a tint draws the eye to them.
    colorPreset: 'soft',
  });
  // Entry point of the workflow → strongest preset.
  const submit = { ...step('Submit request', 0, rowY, 'stadium'), colorPreset: 'bold' };
  const review = step('Manager review', 1, rowY);
  const approved = gate('Approved?', 2);
  const check = step('Finance check', 3, rowY);
  const inBudget = gate('In budget?', 4);
  const done = { ...step('Purchase approved', 5, rowY, 'stadium'), colorPreset: 'soft' };
  // Exception paths sit directly under their gate, so each No drops
  // straight down into the top of its step.
  const rework = { ...step('Request changes', 2, lowY), colorPreset: 'outline' };
  const declined = { ...step('Declined', 4, lowY, 'stadium'), colorPreset: 'outline' };
  const arrows = [
    { ...createPinnedArrow(submit.id, 'e', review.id, 'w') },
    { ...createPinnedArrow(review.id, 'e', approved.id, 'w') },
    { ...createPinnedArrow(approved.id, 'e', check.id, 'w'), label: 'Yes' },
    { ...createPinnedArrow(check.id, 'e', inBudget.id, 'w') },
    { ...createPinnedArrow(inBudget.id, 'e', done.id, 'w'), label: 'Yes' },
    { ...createPinnedArrow(approved.id, 's', rework.id, 'n'), label: 'No' },
    { ...createPinnedArrow(inBudget.id, 's', declined.id, 'n'), label: 'No' },
    // The rework loop runs left under Manager review, then climbs into the
    // bottom of Submit: an L, never a diagonal across the main row.
    {
      ...createPinnedArrow(rework.id, 'w', submit.id, 's'),
      label: 'Revise & resubmit',
      arrowStyle: 'angled' as const,
    },
  ];
  return [...lanes, ...arrows, submit, review, approved, check, inBudget, done, rework, declined];
}
