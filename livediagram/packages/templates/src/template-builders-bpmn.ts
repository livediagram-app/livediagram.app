// The BPMN Process template builder (docs/specs/009-elements/bpmn.md "The template"). Pure: (cx, cy) -> Element[],
// centred on (cx, cy).

import {
  bpmnFields,
  bpmnKindOf,
  BPMN_FLOW_LOOKS,
  createPinnedArrow,
  createShape,
  createText,
  type Anchor,
  type ArrowElement,
  type BpmnSymbol,
  type Element,
  type ShapeElement,
} from '@livediagram/document';

const INK = '#334155';
const MUTED = '#64748b';
const FACE = '#ffffff';
const START = '#16a34a';
const END = '#dc2626';

// The pools' and lanes' washes: the customer's pool violet, the shop's lanes sky and amber.
const CUSTOMER = { band: '#faf5ff', header: '#f3e8ff', line: '#d8b4fe', ink: '#6b21a8' };
const SHOP = { band: '#f8fafc', header: '#e2e8f0', line: '#94a3b8', ink: '#334155' };
const SALES = { band: '#f0f9ff', header: '#e0f2fe', line: '#bae6fd', ink: '#075985' };
const WAREHOUSE = { band: '#fffbeb', header: '#fef3c7', line: '#fde68a', ink: '#92400e' };

type Wash = typeof CUSTOMER;

// The layout, in px from the composition's top-left corner (below its title).
const W = 1400;
const POOL_GUTTER = 40;
const LANE_GUTTER = 30;
const CUSTOMER_TOP = 0;
const CUSTOMER_H = 150;
const SHOP_TOP = 190;
const SALES_H = 220;
const WAREHOUSE_H = 200;
const CUSTOMER_ROW = CUSTOMER_TOP + CUSTOMER_H / 2;
const SALES_ROW = SHOP_TOP + 70;
const WAREHOUSE_ROW = SHOP_TOP + SALES_H + 90;

// A BPMN process modelled the way a modeler draws it: an online order between the customer's pool and the shop's
// pool of two lanes (Sales, Warehouse). It shows every common symbol once: a plain and a message start, user,
// service, manual and send tasks, an exclusive gateway with its Yes and No flows, a parallel split and join, a timer,
// message, plain and end events, a data store and a data object on associations, and two message flows between the
// pools. An event's, gateway's and data element's name is a text under it (above it where a flow meets it from below),
// as BPMN writes them; a task's name is its label.
export function buildBpmnProcess(cx: number, cy: number): Element[] {
  const titleH = 40;
  const captionH = 26;
  const headGap = 20;
  const totalH = titleH + captionH + headGap + SHOP_TOP + SALES_H + WAREHOUSE_H;
  const left = Math.round(cx - W / 2);
  const top = Math.round(cy - totalH / 2);
  const ox = left;
  const oy = top + titleH + captionH + headGap;

  const band = (
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    wash: Wash,
    gutter: number,
  ): ShapeElement => ({
    ...createShape('lane', ox + x, oy + y),
    width,
    height,
    label,
    textSize: 'sm',
    textBold: true,
    textColor: wash.ink,
    textAlignX: 'left',
    textAlignY: 'middle',
    titleOrientation: 'upright',
    fillColor: wash.band,
    strokeColor: wash.line,
    headerFill: wash.header,
    headerSize: gutter,
  });
  const shopH = SALES_H + WAREHOUSE_H;
  const bands = [
    band(0, CUSTOMER_TOP, W, CUSTOMER_H, 'Customer', CUSTOMER, POOL_GUTTER),
    band(0, SHOP_TOP, W, shopH, 'Online Shop', SHOP, POOL_GUTTER),
    band(POOL_GUTTER, SHOP_TOP, W - POOL_GUTTER, SALES_H, 'Sales', SALES, LANE_GUTTER),
    band(
      POOL_GUTTER,
      SHOP_TOP + SALES_H,
      W - POOL_GUTTER,
      WAREHOUSE_H,
      'Warehouse',
      WAREHOUSE,
      LANE_GUTTER,
    ),
  ];

  // A symbol centred on (x, y), in the house's BPMN colours: white faces, a green start, a red end.
  const symbol = (sym: BpmnSymbol, x: number, y: number, label = ''): ShapeElement => {
    const base = createShape(bpmnKindOf(sym), 0, 0);
    const fields = bpmnFields(sym);
    const w = fields.width!;
    const h = fields.height!;
    const stroke = sym.startsWith('start') ? START : sym.startsWith('end') ? END : INK;
    return {
      ...base,
      ...fields,
      x: ox + x - w / 2,
      y: oy + y - h / 2,
      label,
      textSize: 'sm',
      textColor: INK,
      fillColor: FACE,
      strokeColor: stroke,
    };
  };
  // The name BPMN writes outside a symbol: under it, or above it.
  const nameOf = (el: ShapeElement, label: string, above = false): Element => ({
    ...createText(el.x + el.width / 2 - 70, above ? el.y - 24 : el.y + el.height + 4),
    width: 140,
    height: 20,
    label,
    textSize: 'sm',
    textColor: INK,
  });

  // The customer's pool.
  const wants = symbol('start', 84, CUSTOMER_ROW);
  const placeOrder = symbol('task-send', 214, CUSTOMER_ROW, 'Place order');
  const parcelArrives = symbol('intermediate-message', 1184, CUSTOMER_ROW);
  const received = symbol('end', 1314, CUSTOMER_ROW);

  // Sales.
  const orderIn = symbol('start-message', 214, SALES_ROW);
  const checkOrder = symbol('task-user', 344, SALES_ROW, 'Check order');
  const inStock = symbol('gateway-exclusive', 488, SALES_ROW);
  const declined = symbol('end-message', 488, SALES_ROW + 85);
  const split = symbol('gateway-parallel', 618, SALES_ROW);
  const takePayment = symbol('task-service', 774, SALES_ROW, 'Take payment');
  const invoice = symbol('data-object', 774, SALES_ROW + 88);
  const join = symbol('gateway-parallel', 938, SALES_ROW);
  const courier = symbol('intermediate-timer', 1044, SALES_ROW);

  // Warehouse.
  const stock = symbol('data-store', 344, WAREHOUSE_ROW);
  const pick = symbol('task-manual', 774, WAREHOUSE_ROW, 'Pick & pack');
  const ship = symbol('task-send', 1184, WAREHOUSE_ROW, 'Ship parcel');
  const shipped = symbol('end', 1314, WAREHOUSE_ROW);

  const symbols = [
    wants,
    placeOrder,
    parcelArrives,
    received,
    orderIn,
    checkOrder,
    inStock,
    declined,
    split,
    takePayment,
    invoice,
    join,
    courier,
    stock,
    pick,
    ship,
    shipped,
  ];
  const names: Element[] = [
    nameOf(wants, 'Wants a lamp'),
    nameOf(parcelArrives, 'Parcel arrives', true),
    nameOf(received, 'Lamp received'),
    nameOf(orderIn, 'Order in'),
    nameOf(inStock, 'In stock?', true),
    nameOf(declined, 'Sorry, sold out'),
    nameOf(invoice, 'Invoice'),
    nameOf(courier, 'Courier at 4 pm', true),
    nameOf(stock, 'Stock'),
    nameOf(shipped, 'Order shipped'),
  ];

  const flow = (
    from: ShapeElement,
    fromAt: Anchor,
    to: ShapeElement,
    toAt: Anchor,
    extra: Partial<ArrowElement> = {},
  ): ArrowElement => ({
    ...createPinnedArrow(from.id, fromAt, to.id, toAt),
    arrowStyle: 'angled',
    strokeColor: INK,
    routeBehind: false,
    ...extra,
  });
  const lines: ArrowElement[] = [
    // Sequence flows.
    flow(wants, 'e', placeOrder, 'w'),
    flow(placeOrder, 'e', parcelArrives, 'w'),
    flow(parcelArrives, 'e', received, 'w'),
    flow(orderIn, 'e', checkOrder, 'w'),
    flow(checkOrder, 'e', inStock, 'w'),
    flow(inStock, 'e', split, 'w', { label: 'Yes', textColor: INK }),
    flow(inStock, 's', declined, 'n', { label: 'No', textColor: INK }),
    flow(split, 'e', takePayment, 'w'),
    flow(split, 's', pick, 'w'),
    flow(takePayment, 'e', join, 'w'),
    flow(pick, 'e', join, 's'),
    flow(join, 'e', courier, 'w'),
    flow(courier, 's', ship, 'w'),
    flow(ship, 'e', shipped, 'w'),
    // Message flows between the pools.
    flow(placeOrder, 's', orderIn, 'n', { ...BPMN_FLOW_LOOKS.message, arrowStyle: 'straight' }),
    flow(ship, 'n', parcelArrives, 's', { ...BPMN_FLOW_LOOKS.message, arrowStyle: 'straight' }),
    // Associations to the data.
    flow(checkOrder, 's', stock, 'n', { ...BPMN_FLOW_LOOKS.association, arrowStyle: 'straight' }),
    flow(takePayment, 's', invoice, 'n', {
      ...BPMN_FLOW_LOOKS.association,
      arrowStyle: 'straight',
    }),
  ];

  const heading: Element[] = [
    {
      ...createText(left, top),
      width: W,
      height: titleH,
      label: 'Online order · a BPMN process',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: W,
      height: captionH,
      label:
        'Solid lines run the process inside a pool; dashed lines are messages between pools; dotted lines tie on the data.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];

  return [...heading, ...bands, ...lines, ...symbols, ...names];
}
