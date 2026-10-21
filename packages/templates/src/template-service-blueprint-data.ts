// The Service blueprint's content (docs/specs/008-canvas/canvas-and-palette.md "Templates"): one Plateful office
// lunch order, end to end. Pure data; template-builders-service-blueprint.ts draws it.

export const BLUEPRINT_TITLE = 'Plateful · Service blueprint: an office lunch order';
export const BLUEPRINT_CAPTION =
  'Read each stage top to bottom: what the customer sees and does, then everything that serves it, in view and out of it. F marks where it fails, W where it waits.';

export const BLUEPRINT_STAGES = ['Discover', 'Order', 'Wait', 'Receive', 'After'] as const;

export type BlueprintRowId = 'evidence' | 'customer' | 'frontstage' | 'backstage' | 'support';

// The rows, top to bottom: their name, what they mean, their tint and the line drawn under them (if any).
export const BLUEPRINT_ROWS: readonly {
  id: BlueprintRowId;
  name: string;
  meaning: string;
  tint: string;
  card: { fill: string; stroke: string };
  line?: { name: string; style: 'solid' | 'dashed' | 'dotted'; colour: string; bold?: true };
}[] = [
  {
    id: 'evidence',
    name: 'Physical evidence',
    meaning: 'What the customer sees and touches',
    tint: '#f8fafc',
    card: { fill: '#ffffff', stroke: '#cbd5e1' },
  },
  {
    id: 'customer',
    name: 'Customer actions',
    meaning: 'The journey, as they live it',
    tint: '#fef3c7',
    card: { fill: '#fde68a', stroke: '#f59e0b' },
    line: { name: 'Line of interaction', style: 'solid', colour: '#0f172a' },
  },
  {
    id: 'frontstage',
    name: 'Frontstage',
    meaning: 'What our people and app do in view',
    tint: '#e0f2fe',
    card: { fill: '#ffffff', stroke: '#7dd3fc' },
    line: { name: 'Line of visibility', style: 'dashed', colour: '#dc2626', bold: true },
  },
  {
    id: 'backstage',
    name: 'Backstage',
    meaning: 'What they do out of view',
    tint: '#ede9fe',
    card: { fill: '#ffffff', stroke: '#c4b5fd' },
    line: { name: 'Line of internal interaction', style: 'dotted', colour: '#64748b' },
  },
  {
    id: 'support',
    name: 'Support processes',
    meaning: 'The systems underneath',
    tint: '#ecfdf5',
    card: { fill: '#ffffff', stroke: '#6ee7b7' },
  },
];

// Each row's card in each stage, in BLUEPRINT_STAGES order.
export const BLUEPRINT_CARDS: Readonly<Record<BlueprintRowId, readonly string[]>> = {
  evidence: [
    'Push offer: “Team lunch, 20% off”',
    'App menu and the group basket',
    'Live tracking map',
    'Sealed bag, labelled by name',
    'Rating prompt and receipt email',
  ],
  customer: [
    'Sees the offer and opens the app',
    'Builds a group order and splits the bill',
    'Watches the courier on the map',
    'Meets the courier and hands out lunch',
    'Rates it, asks for a refund on one meal',
  ],
  frontstage: [
    'Personalised home feed',
    'Checkout with an ETA promise',
    'Courier assigned: an SMS with their name',
    'Courier hands over and takes a photo',
    'Support chat replies within 2 minutes',
  ],
  backstage: [
    'Rank restaurants by prep time',
    'Kitchen ticket prints at the restaurant',
    'Dispatch batches nearby orders',
    'Courier confirms pickup in the app',
    'Support triages the refund',
  ],
  support: [
    'Menu sync API',
    'Payments and fraud check',
    'Routing engine',
    'Proof-of-delivery store',
    'CRM and refunds ledger',
  ],
};

// How the customer feels at each stage, as an emoji sticker.
export const BLUEPRINT_FEELS = [
  'emoji-smile',
  'emoji-star-struck',
  'emoji-worried',
  'emoji-smile',
  'emoji-neutral',
] as const;

// The marks on the blueprint: on which row and stage, what kind, and the note under the card.
export const BLUEPRINT_MARKS: readonly {
  row: BlueprintRowId;
  stage: number;
  kind: 'fail' | 'wait';
  note: string;
}[] = [
  { row: 'frontstage', stage: 2, kind: 'fail', note: 'The ETA slips with no message' },
  { row: 'frontstage', stage: 3, kind: 'fail', note: 'The wrong bag handed over' },
  { row: 'backstage', stage: 1, kind: 'wait', note: 'Kitchen prep: 12 minutes' },
  { row: 'backstage', stage: 3, kind: 'wait', note: 'Courier waits at the restaurant' },
];

// The moment of truth: the stage the whole service is judged by.
export const BLUEPRINT_MOMENT = 3;

export const BLUEPRINT_FIX = {
  title: 'Fix first',
  text: 'The ETA slips with no message: push a new time the moment dispatch re-batches an order, before the customer has to ask.',
};
