// The flowchart builder (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// ./template-builders-trees (which re-exports it) once it gained a key and
// the full ISO 5807 symbol set. Pure: (cx, cy) -> Element[].

import {
  createPinnedArrow,
  createShape,
  createText,
  type Element,
  type ShapeElement,
  type ShapeKind,
} from '@livediagram/document';

// Flowchart: a checkout, the process everyone has been through, drawn with
// the five ISO 5807 symbols a flowchart actually uses, each keeping ONE look
// so the key beside it reads the whole diagram cold:
//   - terminator (stadium): where the flow starts (bold) and ends (soft),
//   - process (rectangle): a step someone or something does,
//   - decision (diamond, soft): a yes / no question, both exits labelled,
//   - input / output (parallelogram): data entering the flow,
//   - document (wavy-bottomed page): something the flow produces.
// The happy path runs straight down one column. The two No exits step out to
// a side column: a declined card shows an error (outlined, the exception
// idiom) and loops back up to the card form, and an out-of-stock item is
// back-ordered and rejoins at the receipt. Every loop is an elbow, never a
// diagonal across the spine. The action steps carry a line-art glyph for
// what they touch (the cart, the card, the parcel, the email), so the flow
// reads at a glance before a single label is.
const MUTED = '#64748b';

// `keyH` is the symbol's height in the key, where every miniature is 56 wide:
// scaling the real aspect down squashed the terminator into a hairline.
type NodeSpec = {
  kind: ShapeKind;
  w: number;
  h: number;
  keyH: number;
  look?: Partial<ShapeElement>;
};
const TERMINATOR: NodeSpec = { kind: 'stadium', w: 220, h: 64, keyH: 24 };
const PROCESS: NodeSpec = { kind: 'square', w: 220, h: 72, keyH: 30 };
const DECISION: NodeSpec = {
  kind: 'diamond',
  w: 210,
  h: 120,
  keyH: 34,
  look: { colorPreset: 'soft' },
};
const INPUT: NodeSpec = { kind: 'parallelogram', w: 250, h: 72, keyH: 28 };
const DOCUMENT: NodeSpec = { kind: 'document', w: 220, h: 84, keyH: 32 };

export function buildFlowchart(cx: number, cy: number): Element[] {
  const rowGap = 44;
  const colGap = 110;
  const titleH = 44;
  const captionH = 28;
  const keyW = 250;
  const keyGap = 72;
  const spine = [
    { spec: TERMINATOR, label: 'Checkout', look: { colorPreset: 'bold', iconId: 'cart' } },
    { spec: INPUT, label: 'Enter card details' },
    { spec: PROCESS, label: 'Charge card', look: { iconId: 'credit-card' } },
    { spec: DECISION, label: 'Payment OK?' },
    { spec: DECISION, label: 'In stock?' },
    { spec: DOCUMENT, label: 'Email receipt', look: { iconId: 'mail' } },
    { spec: TERMINATOR, label: 'Order placed', look: { colorPreset: 'soft' } },
  ];
  const spineH = spine.reduce((h, n) => h + n.spec.h, 0) + rowGap * (spine.length - 1);
  const mainW = INPUT.w + colGap + PROCESS.w;
  const totalW = mainW + keyGap + keyW;
  const totalH = titleH + captionH + 32 + spineH;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;
  const spineX = left + INPUT.w / 2;
  const sideX = left + INPUT.w + colGap + PROCESS.w / 2;

  const node = (
    spec: NodeSpec,
    label: string,
    x: number,
    y: number,
    look?: Partial<ShapeElement>,
  ) => ({
    ...createShape(spec.kind, x - spec.w / 2, y),
    width: spec.w,
    height: spec.h,
    label,
    ...spec.look,
    ...look,
  });

  let y = top + titleH + captionH + 32;
  const [start, input, charge, paid, inStock, receipt, end] = spine.map((n) => {
    const el = node(n.spec, n.label, spineX, y, n.look);
    y += n.spec.h + rowGap;
    return el;
  }) as ShapeElement[];
  // Side steps sit level with the decision that sends them out.
  const beside = (gate: ShapeElement, label: string, look?: Partial<ShapeElement>) =>
    node(PROCESS, label, sideX, gate.y + (gate.height - PROCESS.h) / 2, look);
  const error = beside(paid!, 'Show card error', {
    colorPreset: 'outline',
    iconId: 'alert-triangle',
  });
  const backorder = beside(inStock!, 'Back-order item', { iconId: 'package' });

  const angled = 'angled' as const;
  const arrows = [
    createPinnedArrow(start!.id, 's', input!.id, 'n'),
    createPinnedArrow(input!.id, 's', charge!.id, 'n'),
    createPinnedArrow(charge!.id, 's', paid!.id, 'n'),
    { ...createPinnedArrow(paid!.id, 's', inStock!.id, 'n'), label: 'Yes' },
    { ...createPinnedArrow(paid!.id, 'e', error.id, 'w'), label: 'No' },
    // The retry loop climbs the side column, then turns into the form.
    { ...createPinnedArrow(error.id, 'n', input!.id, 'e'), arrowStyle: angled, label: 'Try again' },
    { ...createPinnedArrow(inStock!.id, 's', receipt!.id, 'n'), label: 'Yes' },
    { ...createPinnedArrow(inStock!.id, 'e', backorder.id, 'w'), label: 'No' },
    // The back-order rejoins the happy path at the receipt.
    { ...createPinnedArrow(backorder.id, 's', receipt!.id, 'e'), arrowStyle: angled },
    createPinnedArrow(receipt!.id, 's', end!.id, 'n'),
  ];

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

  // The key: one miniature per symbol, in the diagram's own presets, on a
  // quiet card level with the top of the flow.
  const keyX = left + mainW + keyGap;
  const keyTop = top + titleH + captionH + 32;
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
  const key: Element[] = [
    {
      ...createShape('square', keyX, keyTop),
      width: keyW,
      height: keyH,
      label: '',
      fillColor: '#f8fafc',
      strokeColor: '#cbd5e1',
    },
    {
      ...createText(keyX + keyPad, keyTop + keyPad),
      width: keyW - keyPad * 2,
      height: 28,
      label: 'Key',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
    },
  ];
  rows.forEach(([spec, caption, look], i) => {
    const ry = keyTop + keyPad + 40 + i * rowH;
    const iconW = 56;
    const iconH = spec.keyH;
    key.push(
      {
        ...createShape(spec.kind, keyX + keyPad, ry + (36 - iconH) / 2),
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

  return [
    ...header,
    ...arrows,
    start!,
    input!,
    charge!,
    paid!,
    inStock!,
    receipt!,
    end!,
    error,
    backorder,
    ...key,
  ];
}
