// The sequence diagram template (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// template-builders-technical.ts once it gained activations, a self-call and
// an alt fragment.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createArrow,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type ArrowheadShape,
  type Element,
} from '@livediagram/document';
import { techHeader, TECH_HEADER_H, TECH_MUTED } from './template-builders-technical-kit';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// Plateful's checkout as a UML sequence diagram that follows the notation
// rather than gesturing at it. Five participants: the Customer as a UML
// actor, then the app, the Orders API, Payments and the kitchen tablet as
// headed boxes, each over a dashed lifeline. Narrow activation bars show
// who is busy and for how long, and the three message kinds read apart:
// synchronous calls are solid with a filled head, the asynchronous
// OrderPlaced event is solid with an open head, and replies are dashed with
// an open head. The API validates the basket with a self-call (its own
// nested activation), asks Payments to authorise, and then an `alt`
// combined fragment splits on the result: [authorised] fires the kitchen
// event and confirms the order, [declined] asks for another card. A note
// beside Payments records the one design decision a reviewer asks about
// (idempotency). Messages are numbered so a review can say "step 4".
//
// Messages are free arrows ending on the activation bars' edges: a
// sequence diagram's geometry is the point. Participant headers and
// lifelines are the "Lifelines" scaffold; everything that happens along
// them (bars, messages, the fragment, the note) rides "Messages".
type Kind = 'call' | 'async' | 'reply';
type Msg = { from: number; to: number; label: string; kind: Kind };

const PARTICIPANTS: { label: string; icon?: string }[] = [
  { label: 'Customer' },
  { label: 'Plateful app', icon: 'smartphone' },
  { label: 'Orders API', icon: 'server' },
  { label: 'Payments', icon: 'credit-card' },
  { label: 'Kitchen tablet', icon: 'monitor' },
];

const HEAD: Record<Kind, ArrowheadShape> = { call: 'triangle', async: 'line', reply: 'line' };

export function buildSequenceDiagram(cx: number, cy: number): Element[] {
  const pitch = 260;
  const headW = 196;
  const headH = 60;
  const bar = 14; // activation bar width
  const actorW = 44;
  const actorH = 60;
  const step = 52; // vertical pitch between messages
  const selfH = 40; // drop of the self-call loop
  const noteGap = 40;
  const noteW = pitch - 2 * noteGap;
  const width = (PARTICIPANTS.length - 1) * pitch + headW;
  // Rows, top to bottom, in message steps: 1-5 before the fragment, the
  // fragment's label band, three [authorised] messages, the operand
  // divider, two [declined] messages.
  const bodyH = 60 + 4 * step + selfH + 36 + 44 + 3 * step + 36 + 2 * step + 70;
  const height = TECH_HEADER_H + 28 + headH + bodyH;
  const left = cx - width / 2;
  const top = cy - height / 2;
  const headTop = top + TECH_HEADER_H + 28;
  const lifeTop = headTop + headH;
  const lifeBottom = lifeTop + bodyH;
  const px = (i: number) => left + headW / 2 + i * pitch;

  const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
  const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };
  const elements: Element[] = techHeader(
    left,
    top,
    width,
    'Checkout · placing an order',
    'Solid heads are calls, open heads async events, dashed lines replies. Bars show who is busy; the alt box splits on the payment result.',
    { title: TEMPLATE_CONTENT_LAYER_ID, caption: TEMPLATE_SCAFFOLD_LAYER_ID },
  );

  // Participants and lifelines.
  PARTICIPANTS.forEach((p, i) => {
    const x = px(i);
    if (p.icon) {
      elements.push({
        ...createShape('square', x - headW / 2, headTop),
        width: headW,
        height: headH,
        label: p.label,
        iconId: p.icon,
        iconPosition: 'left',
        textSize: 'md',
        textBold: true,
        ...scaffold,
      });
    } else {
      // The UML actor: a stick figure with its name as its own line beneath
      // (the actor's in-box caption would sit on its legs), ending on the
      // same baseline as the headed boxes.
      elements.push(
        {
          ...createShape('actor', x - actorW / 2, headTop + headH - 24 - actorH),
          width: actorW,
          height: actorH,
          label: '',
          ...scaffold,
        },
        {
          ...createText(x - headW / 2, headTop + headH - 24),
          width: headW,
          height: 24,
          label: p.label,
          textSize: 'md',
          textBold: true,
          ...scaffold,
        },
      );
    }
    elements.push({
      ...createArrow(x, lifeTop, x, lifeBottom),
      arrowEnds: 'none',
      strokeStyle: 'dashed',
      ...scaffold,
    });
  });

  // Message rows. `y` walks down the page; each block below advances it.
  let y = lifeTop + 60;
  const rows: { msg: Msg; y: number }[] = [];
  const add = (msg: Msg) => {
    rows.push({ msg, y });
    y += step;
  };

  add({ from: 0, to: 1, label: '1: Place order', kind: 'call' });
  add({ from: 1, to: 2, label: '2: POST /orders', kind: 'call' });
  const selfY = y;
  y += selfH + 36; // 3 is the self-call, drawn below
  add({ from: 2, to: 3, label: '4: authorise £23.40', kind: 'call' });
  add({ from: 3, to: 2, label: '5: auth result', kind: 'reply' });
  const fragTop = y - 18;
  y += 44;
  add({ from: 2, to: 4, label: '6: OrderPlaced', kind: 'async' });
  add({ from: 2, to: 1, label: '7: 201 Created · #4821', kind: 'reply' });
  add({ from: 1, to: 0, label: '8: Show order tracker', kind: 'reply' });
  const dividerY = y - step / 2 + 18;
  y += 36;
  add({ from: 2, to: 1, label: '9: 402 Payment required', kind: 'reply' });
  add({ from: 1, to: 0, label: '10: Try another card', kind: 'reply' });
  const fragBottom = y - step / 2 + 22;

  // Activation bars, drawn before the messages so heads land on top.
  const activation = (i: number, y0: number, y1: number, offset = 0) => ({
    ...createShape('square', px(i) - bar / 2 + offset, y0),
    width: bar,
    height: y1 - y0,
    borderRadius: 'none' as const,
    ...content,
  });
  const rowY = (n: number) => rows.find((r) => r.msg.label.startsWith(`${n}:`))!.y;
  const paymentsBar = activation(3, rowY(4) - 6, rowY(5) + 6);
  elements.push(
    activation(1, rowY(1) - 6, rowY(10) + 6),
    activation(2, rowY(2) - 6, rowY(9) + 6),
    // The self-call's nested activation, stepped right off the API's bar.
    activation(2, selfY + selfH - 10, selfY + selfH + 16, bar / 2),
    paymentsBar,
    activation(4, rowY(6) - 6, rowY(6) + 30),
  );

  // Which edge of the target's bar a message meets: the near side.
  const edgeX = (i: number, towardRight: boolean) =>
    i === 0 ? px(0) : px(i) + (towardRight ? -bar / 2 : bar / 2);
  for (const { msg, y: my } of rows) {
    const right = msg.to > msg.from;
    // A message that passes over a lifeline (6 crosses Payments) keeps its
    // label off that lifeline.
    const t = Math.abs(msg.to - msg.from) === 2 ? 0.28 : 0.5;
    elements.push({
      ...createArrow(edgeX(msg.from, !right), my, edgeX(msg.to, right), my),
      label: msg.label,
      // Lift the label clear of the line: a negative offset reads as above
      // for rightward messages, a positive one for leftward replies.
      labelOffset: { t, offset: right ? -14 : 14 },
      arrowheadShape: HEAD[msg.kind],
      ...(msg.kind === 'reply' ? { strokeStyle: 'dashed' as const } : {}),
      ...content,
    });
  }

  // 3: the self-call loops out of the API's bar and back into its nested one.
  // The loop is an angled arrow through two waypoints, which are deltas
  // from the chord's midpoint.
  const sx = px(2) + bar / 2;
  const loop = 56;
  elements.push({
    ...createArrow(sx, selfY, sx + bar / 2, selfY + selfH),
    arrowStyle: 'angled',
    curvePoints: [
      { dx: loop - bar / 4, dy: -selfH / 2 },
      { dx: loop - bar / 4, dy: selfH / 2 },
    ],
    label: '3: validate basket',
    labelOffset: { t: 0.5, offset: -70 },
    ...content,
  });

  // The alt fragment: a frame spanning every lifeline it touches, a guard
  // per operand, and a dashed divider between them.
  const fragLeft = px(0) - 70;
  const fragRight = px(4) + headW / 2 - 20;
  elements.push(
    {
      ...createShape('frame', fragLeft, fragTop),
      width: fragRight - fragLeft,
      height: fragBottom - fragTop,
      label: 'alt',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(px(0) + 12, fragTop + 17),
      width: 180,
      height: 26,
      label: '[payment authorised]',
      textSize: 'sm',
      textColor: TECH_MUTED,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createArrow(fragLeft + 12, dividerY, fragRight - 12, dividerY),
      arrowEnds: 'none',
      strokeStyle: 'dashed',
      ...content,
    },
    {
      ...createText(px(0) + 12, dividerY + 4),
      width: 180,
      height: 26,
      label: '[declined]',
      textSize: 'sm',
      textColor: TECH_MUTED,
      textAlignX: 'left',
      ...content,
    },
  );

  // A UML note: the decision a reviewer asks about first, in the quiet
  // column between Payments and the kitchen (which is idle until 6), tied
  // to the Payments activation by a dashed anchor line.
  const note = {
    ...createSticky(px(3) + noteGap, rowY(4) - 150),
    width: noteW,
    height: 104,
    label: 'Idempotency key = order id, so a retried authorise never charges twice.',
    textSize: 'sm' as const,
    ...content,
  };
  elements.push(note, {
    ...createPinnedArrow(note.id, 's', paymentsBar.id, 'e'),
    arrowEnds: 'none',
    strokeStyle: 'dashed',
    ...content,
  });

  return elements;
}
