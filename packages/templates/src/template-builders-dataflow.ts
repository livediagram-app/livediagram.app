import {
  createArrow,
  createPinnedArrow,
  createShape,
  createText,
  type Element,
} from '@livediagram/diagram';

// Data flow diagram (docs/specs/008-canvas/canvas-and-palette.md): a level-1 DFD of an online shop, the
// worked example that teaches the notation. Split out of
// ./template-builders-flows because it carries its own legend and grid.
//
// The four DFD symbols each keep ONE look, repeated in the key under the
// diagram so a newcomer can read it cold:
//   - external entity: a bold square (the outside world, strongest ink),
//   - process: a soft circle with a hierarchical number ("1.0 Take order"),
//   - data store: a cylinder with a D-number ("D1 Orders"),
//   - data flow: a labelled arrow naming the DATA it carries, never a verb
//     or a repeat of the node it points at.
//
// Nodes sit on a 4 x 3 grid so every flow is a straight run between grid
// neighbours, bar the dispatch notice which elbows back to the Customer.
const MUTED = '#64748b';

export function buildDataFlow(cx: number, cy: number): Element[] {
  const colX = [cx - 480, cx - 160, cx + 160, cx + 480];
  const rowY = [cy - 200, cy, cy + 200];
  const entityW = 160;
  // 100 tall so the entity's nw / sw corners line up with the process
  // circle's ne / se points: the two payment flows run level.
  const entityH = 100;
  const procD = 140;
  const storeW = 160;
  const storeH = 90;

  const entity = (label: string, col: number, row: number) => ({
    ...createShape('square', colX[col]! - entityW / 2, rowY[row]! - entityH / 2),
    width: entityW,
    height: entityH,
    label,
    colorPreset: 'bold',
  });
  const process = (label: string, col: number, row: number) => ({
    ...createShape('circle', colX[col]! - procD / 2, rowY[row]! - procD / 2),
    width: procD,
    height: procD,
    label,
    colorPreset: 'soft',
  });
  const store = (label: string, col: number, row: number) => ({
    ...createShape('cylinder', colX[col]! - storeW / 2, rowY[row]! - storeH / 2),
    width: storeW,
    height: storeH,
    label,
  });

  const customer = entity('Customer', 0, 1);
  const provider = entity('Payment provider', 3, 1);
  const takeOrder = process('1.0 Take order', 1, 1);
  const takePayment = process('2.0 Take payment', 2, 1);
  const fulfil = process('3.0 Fulfil order', 1, 2);
  const customers = store('D2 Customers', 1, 0);
  const orders = store('D1 Orders', 2, 2);

  const flow = (
    from: { id: string },
    fromAnchor: Parameters<typeof createPinnedArrow>[1],
    to: { id: string },
    toAnchor: Parameters<typeof createPinnedArrow>[3],
    label: string,
  ) => ({ ...createPinnedArrow(from.id, fromAnchor, to.id, toAnchor), label });
  const arrows = [
    flow(customer, 'e', takeOrder, 'w', 'Order details'),
    flow(takeOrder, 'n', customers, 's', 'Contact details'),
    flow(takeOrder, 'e', takePayment, 'w', 'Amount due'),
    // A request / response pair drawn as two parallel flows, one each way,
    // rather than one double-headed arrow: DFD flows carry one packet each.
    flow(takePayment, 'ne', provider, 'nw', 'Card charge'),
    flow(provider, 'sw', takePayment, 'se', 'Payment result'),
    flow(takePayment, 's', orders, 'n', 'Paid order'),
    flow(orders, 'w', fulfil, 'e', 'Order to ship'),
    {
      ...flow(fulfil, 'w', customer, 's', 'Dispatch notice'),
      arrowStyle: 'angled' as const,
    },
  ];

  const title = {
    ...createText(colX[0]! - entityW / 2, rowY[0]! - storeH / 2 - 96),
    width: 640,
    height: 48,
    label: 'Online shop · level 1 data flow',
    textSize: 'lg' as const,
    textBold: true,
    textAlignX: 'left' as const,
  };

  // The key: one miniature of each symbol, same presets as the diagram,
  // with a muted caption, in a row under the last grid row, left-aligned
  // with the title.
  const keyY = rowY[2]! + procD / 2 + 70;
  const keyLeft = colX[0]! - entityW / 2;
  const keyX = keyLeft + 56;
  const cell = 180;
  const icon = 30;
  const captionW = 130;
  const caption = (i: number, label: string) => ({
    ...createText(keyX + i * cell + icon + 12, keyY - 14),
    width: captionW,
    height: 28,
    label,
    textSize: 'sm' as const,
    textColor: MUTED,
    textAlignX: 'left' as const,
  });
  const keyTitle = {
    ...createText(keyLeft, keyY - 14),
    width: 48,
    height: 28,
    label: 'Key',
    textSize: 'sm' as const,
    textBold: true,
    textColor: MUTED,
    textAlignX: 'left' as const,
  };
  const key: Element[] = [
    keyTitle,
    {
      ...createShape('square', keyX, keyY - 11),
      width: icon,
      height: 22,
      label: '',
      colorPreset: 'bold',
    },
    caption(0, 'External entity'),
    {
      ...createShape('circle', keyX + cell, keyY - icon / 2),
      width: icon,
      height: icon,
      label: '',
      colorPreset: 'soft',
    },
    caption(1, 'Process'),
    {
      ...createShape('cylinder', keyX + 2 * cell, keyY - icon / 2),
      width: icon,
      height: icon,
      label: '',
    },
    caption(2, 'Data store'),
    createArrow(keyX + 3 * cell, keyY, keyX + 3 * cell + icon, keyY),
    caption(3, 'Data flow'),
  ];

  return [
    title,
    ...arrows,
    customer,
    provider,
    takeOrder,
    takePayment,
    fulfil,
    customers,
    orders,
    ...key,
  ];
}
