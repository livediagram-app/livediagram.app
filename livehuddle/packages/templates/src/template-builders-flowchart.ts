// The flowchart builder (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// ./template-builders-trees (which re-exports it) once it gained a key and
// the full ISO 5807 symbol set. Pure: (cx, cy) -> Element[].

import {
  FLOWCHART_STEP_KIND,
  FLOWCHART_STEP_SIZE,
  createPinnedArrow,
  createShape,
  createText,
  type Element,
  type FlowchartStepType,
  type ShapeElement,
} from '@livehuddle/document';
import { liveFlowchart } from './template-flowchart-live';

// Flowchart: a checkout, the process everyone has been through, drawn with
// the five ISO 5807 symbols a flowchart actually uses, each keeping ONE look
// so the key beside it reads the whole diagram cold:
//   - terminator (stadium): where the flow starts (bold) and ends (soft),
//   - process (rectangle): a step someone or something does,
//   - decision (diamond, soft): a yes / no question, both exits labelled,
//   - input / output (parallelogram): data entering the flow,
//   - document (wavy-bottomed page): something the flow produces.
// It is a live flowchart (docs/specs/009-elements/flowchart.md "Templates"): every step carries
// the chart, and the flowchart layout places them, so Tab and Enter grow it in place. A declined card
// shows an error (outlined, the exception idiom) and loops back up to the card form, and an
// out-of-stock item is back-ordered and rejoins at the receipt. The action steps carry a line-art glyph for
// what they touch (the cart, the card, the parcel, the email), so the flow
// reads at a glance before a single label is.
const MUTED = '#64748b';

// `keyH` is the symbol's height in the key, where every miniature is 56 wide:
// scaling the real aspect down squashed the terminator into a hairline.
type NodeSpec = { type: FlowchartStepType; keyH: number; look?: Partial<ShapeElement> };
const TERMINATOR: NodeSpec = { type: 'terminator', keyH: 24 };
const PROCESS: NodeSpec = { type: 'process', keyH: 30 };
const DECISION: NodeSpec = { type: 'decision', keyH: 34, look: { colorPreset: 'soft' } };
const INPUT: NodeSpec = { type: 'io', keyH: 28 };
const DOCUMENT: NodeSpec = { type: 'document', keyH: 32 };

export function buildFlowchart(cx: number, cy: number): Element[] {
  const titleH = 44;
  const captionH = 28;
  const keyW = 250;
  const keyGap = 72;

  const node = (spec: NodeSpec, label: string, look?: Partial<ShapeElement>): ShapeElement => ({
    ...createShape(FLOWCHART_STEP_KIND[spec.type], 0, 0),
    ...FLOWCHART_STEP_SIZE[spec.type],
    label,
    ...spec.look,
    ...look,
  });
  const start = node(TERMINATOR, 'Checkout', { colorPreset: 'bold', iconId: 'cart' });
  const input = node(INPUT, 'Enter card details');
  const charge = node(PROCESS, 'Charge card', { iconId: 'credit-card' });
  const paid = node(DECISION, 'Payment OK?');
  const inStock = node(DECISION, 'In stock?');
  const receipt = node(DOCUMENT, 'Email receipt', { iconId: 'mail' });
  const end = node(TERMINATOR, 'Order placed', { colorPreset: 'soft' });
  const error = node(PROCESS, 'Show card error', {
    colorPreset: 'outline',
    iconId: 'alert-triangle',
  });
  const backorder = node(PROCESS, 'Back-order item', { iconId: 'package' });
  const steps = [start, input, charge, paid, inStock, receipt, end, error, backorder];

  const link = (from: ShapeElement, to: ShapeElement, label?: string) => ({
    ...createPinnedArrow(from.id, 's', to.id, 'n'),
    arrowStyle: 'angled' as const,
    ...(label ? { label } : {}),
  });
  const connectors = [
    link(start, input),
    link(input, charge),
    link(charge, paid),
    link(paid, inStock, 'Yes'),
    link(paid, error, 'No'),
    // The retry loop runs back up to the form.
    link(error, input, 'Try again'),
    link(inStock, receipt, 'Yes'),
    link(inStock, backorder, 'No'),
    // The back-order rejoins the happy path at the receipt.
    link(backorder, receipt),
    link(receipt, end),
  ];

  const rows: [NodeSpec, string, Partial<ShapeElement>?][] = [
    [TERMINATOR, 'Start or end', { colorPreset: 'bold' }],
    [PROCESS, 'Process step'],
    [DECISION, 'Decision (yes / no)'],
    [INPUT, 'Input or output'],
    [DOCUMENT, 'Document'],
  ];
  const rowH = 52;
  const keyPad = 20;
  const keyH = keyPad + 32 + rows.length * rowH + keyPad - 12;

  // Laid out once to learn its size, then placed so title, chart and key centre on (cx, cy).
  const probe = liveFlowchart(steps, connectors, { direction: 'down', left: 0, top: 0 }).bounds;
  const totalW = probe.width + keyGap + keyW;
  const totalH = titleH + captionH + 32 + Math.max(probe.height, keyH);
  const left = Math.round(cx - totalW / 2);
  const top = Math.round(cy - totalH / 2);
  const chartTop = top + titleH + captionH + 32;
  const chart = liveFlowchart(steps, connectors, { direction: 'down', left, top: chartTop });

  const header: Element[] = [
    {
      ...createText(left, top),
      width: totalW,
      height: titleH,
      label: 'Checkout flow',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: totalW,
      height: captionH,
      label: 'Follow one order from cart to confirmation. Each shape means one thing: see the key.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];

  // The key: one miniature per symbol, in the diagram's own presets, in a
  // hairline frame level with the top of the flow. Plain shapes, not steps.
  // The frame is see-through, so each miniature sits on the canvas as its step
  // does and matches it in a dark theme too (a pale card turned them into dark
  // blots that matched nothing).
  const keyX = left + probe.width + keyGap;
  const key: Element[] = [
    {
      ...createShape('square', keyX, chartTop),
      width: keyW,
      height: keyH,
      label: '',
      fillColor: 'transparent',
      strokeColor: '#cbd5e1',
    },
    {
      ...createText(keyX + keyPad, chartTop + keyPad),
      width: keyW - keyPad * 2,
      height: 28,
      label: 'Key',
      textSize: 'md',
      textBold: true,
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
  rows.forEach(([spec, caption, look], i) => {
    const ry = chartTop + keyPad + 40 + i * rowH;
    const iconW = 56;
    const iconH = spec.keyH;
    key.push(
      {
        ...createShape(FLOWCHART_STEP_KIND[spec.type], keyX + keyPad, ry + (36 - iconH) / 2),
        width: iconW,
        height: iconH,
        label: '',
        ...spec.look,
        ...look,
      },
      {
        ...createText(keyX + keyPad + iconW + 14, ry + 4),
        width: keyW - keyPad * 2 - iconW - 14,
        height: 28,
        label: caption,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
      },
    );
  });

  return [...header, ...chart.elements, ...key];
}
