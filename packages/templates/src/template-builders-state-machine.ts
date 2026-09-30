// The UML state machine template (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// template-builders-uml.ts once it grew a composite state, guards and
// three exits.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createPinnedArrow, createShape, type Anchor, type Element } from '@livediagram/document';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';

// A Plateful order's lifecycle as a UML state machine, using the notation
// rather than a flowchart that looks like one. Every transition is labelled
// in UML's `event [guard] / action` form: a plain event ("start cooking"),
// a guard ("pickup [PIN ok]"), an action ("decline, after(5 min) / refund",
// which also shows two triggers and a time event), and a self-transition
// on Out for delivery ("location ping / update ETA") that re-enters the
// state without leaving it.
//
// The happy path runs left to right along one row: the solid initial
// pseudostate, Placed, then a composite "In the kitchen" state wrapping
// Accepted, Preparing and Ready, then Out for delivery and Delivered into a
// bullseye final state. Placed has two exits (up to Rejected when the
// restaurant declines or the five-minute timer fires, down to Cancelled
// when the customer cancels before acceptance), and the composite's single
// "out of stock / refund" transition leaves from its border, which in UML
// means "from any state inside". Each exception state ends in its own final
// state, drawn beside the initial dot so the three terminals read as one
// column of outcomes.
//
// The states match the order_status enum the database schema and class
// diagram templates declare. The pseudostates lock their ink so the dots
// stay solid under every theme.
type Node = Extract<Element, { type: 'shape' }>;

const INK = '#1e293b';

export function buildStateMachine(cx: number, cy: number): Element[] {
  const stateW = 176;
  const stateH = 60;
  // Wide enough that every event label between two states sits on one line.
  const pitch = 310;
  const rowGap = 180; // centre to centre between the exception rows and the happy path
  // The pseudostates sit a short hop off the first and last state, not a
  // whole column away. Columns 1..6 are Placed .. Delivered.
  const hop = 170;
  const spanW = 5 * pitch + 2 * hop;
  const headGap = 36;
  const bodyH = 2 * rowGap + stateH;
  const totalH = TECH_HEADER_H + headGap + bodyH;
  const left = cx - spanW / 2;
  const top = cy - totalH / 2;
  const midY = top + TECH_HEADER_H + headGap + rowGap + stateH / 2;
  const colX = (c: number) => left + hop + (c - 1) * pitch;
  const startX = left;
  const endX = left + spanW;

  const elements: Element[] = techHeader(
    left,
    top,
    spanW,
    'Plateful · order lifecycle',
    'Transitions read event [guard] / action. A line leaving the kitchen box applies to every state inside it.',
  );

  // The composite state first so it paints under its substates.
  const kitchenPad = 30;
  elements.push({
    ...createShape('frame', colX(2) - stateW / 2 - kitchenPad, midY - stateH / 2 - 52),
    width: 2 * pitch + stateW + 2 * kitchenPad,
    height: stateH + 52 + kitchenPad,
    label: 'In the kitchen',
    textSize: 'sm',
    textBold: true,
    textAlignX: 'left',
  });
  const kitchen = elements[elements.length - 1] as Node;

  const state = (label: string, col: number, dy = 0, extra: Partial<Node> = {}): Node => ({
    ...createShape('stadium', colX(col) - stateW / 2, midY + dy - stateH / 2),
    width: stateW,
    height: stateH,
    label,
    textSize: 'md',
    ...extra,
  });
  const placed = state('Placed', 1, 0, { colorPreset: 'soft' });
  const accepted = state('Accepted', 2);
  const preparing = state('Preparing', 3);
  const ready = state('Ready', 4);
  const onTheWay = state('Out for delivery', 5);
  const delivered = state('Delivered', 6, 0, { colorPreset: 'bold' });
  const rejected = state('Rejected', 1, -rowGap, { colorPreset: 'outline' });
  const cancelled = state('Cancelled', 1, rowGap, { colorPreset: 'outline' });
  elements.push(placed, accepted, preparing, ready, onTheWay, delivered, rejected, cancelled);

  // Pseudostates: the solid initial dot, and a bullseye (a ring around a
  // dot) per final state.
  const dot = 28;
  const initial: Node = {
    ...createShape('circle', startX, midY - dot / 2),
    width: dot,
    height: dot,
    fillColor: INK,
    strokeColor: INK,
    themeLockFill: true,
  };
  elements.push(initial);
  const bullseye = (x: number, y: number): Node => {
    const ring = 38;
    const core = 20;
    const outer: Node = {
      ...createShape('circle', x - ring / 2, y - ring / 2),
      width: ring,
      height: ring,
      fillColor: '#ffffff',
      strokeColor: INK,
      strokeWidth: 'thick',
      themeLockFill: true,
    };
    elements.push(outer, {
      ...createShape('circle', x - core / 2, y - core / 2),
      width: core,
      height: core,
      fillColor: INK,
      strokeColor: INK,
      themeLockFill: true,
    });
    return outer;
  };
  const doneFinal = bullseye(endX - 19, midY);
  const rejectedFinal = bullseye(startX + dot / 2, midY - rowGap);
  const cancelledFinal = bullseye(startX + dot / 2, midY + rowGap);

  const go = (from: Node, fromA: Anchor, to: Node, toA: Anchor, label?: string, extra = {}) => ({
    ...createPinnedArrow(from.id, fromA, to.id, toA),
    ...(label ? { label } : {}),
    ...extra,
  });
  elements.push(
    go(initial, 'e', placed, 'w'),
    go(placed, 'e', accepted, 'w', 'accept'),
    go(accepted, 'e', preparing, 'w', 'start cooking'),
    go(preparing, 'e', ready, 'w', 'food packed'),
    // Leaves the kitchen box, so its label sits past the border.
    go(ready, 'e', onTheWay, 'w', 'pickup [PIN ok]', { labelOffset: { t: 0.62, offset: 0 } }),
    go(onTheWay, 'e', delivered, 'w', 'handed over'),
    go(delivered, 'e', doneFinal, 'w'),
    // Vertical labels wrap narrow, so they break where UML's syntax does.
    go(placed, 'n', rejected, 's', 'decline,\nafter(5 min)\n/ refund'),
    go(placed, 's', cancelled, 'n', 'cancel\n[not accepted]\n/ refund'),
    go(kitchen, 's', cancelled, 'e', 'out of stock / refund', { arrowStyle: 'angled' }),
    go(rejected, 'w', rejectedFinal, 'e'),
    go(cancelled, 'w', cancelledFinal, 'e'),
    // The self-transition: out of the state's top and back in, looping
    // above it through two waypoints (deltas from the chord's midpoint).
    go(onTheWay, 'nne', onTheWay, 'nnw', 'location ping / update ETA', {
      arrowStyle: 'angled',
      curvePoints: [
        { dx: stateW / 4, dy: -44 },
        { dx: -stateW / 4, dy: -44 },
      ],
      // Above the loop's top run, which travels right to left.
      labelOffset: { t: 0.5, offset: 16 },
    }),
  );

  return elements;
}
