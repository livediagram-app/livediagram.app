// The Wardley map's content (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Plateful's group lunch orders
// mapped as a value chain on evolution. Pure data; template-builders-wardley.ts draws it.

export const WARDLEY_TITLE = 'Plateful · Wardley map: group lunch orders';
export const WARDLEY_CAPTION =
  'Map, then move: each component sits as high as the user can see it and as far right as it has evolved. Lines are needs; red arrows are where things are heading.';

// The four stages of evolution, left to right, with where each ends (0 to 1 across the map) and its character.
export const WARDLEY_STAGES: readonly { name: string; to: number; trait: string; tint: string }[] =
  [
    { name: 'Genesis', to: 0.175, trait: 'Rare and poorly understood', tint: '#f5f3ff' },
    { name: 'Custom-built', to: 0.4, trait: 'Learning by building it', tint: '#eff6ff' },
    {
      name: 'Product (+rental)',
      to: 0.7,
      trait: 'A feature race, increasingly common',
      tint: '#f0fdf4',
    },
    {
      name: 'Commodity (+utility)',
      to: 1,
      trait: 'Standard, expected, a cost of business',
      tint: '#f8fafc',
    },
  ];

// The anchor: who the map is for, and what they need.
export const WARDLEY_USER = 'Office manager';

export type WardleyComponent = {
  id: string;
  label: string;
  // Evolution, 0 (Genesis) to 1 (Commodity), and visibility, 0 (invisible) to 1 (visible to the user).
  evolution: number;
  visibility: number;
  // Where it is heading, and why (a movement), if anywhere.
  heading?: { evolution: number; caption: string };
  // A play's number marker on it (1 to 3).
  play?: number;
  // A bar of inertia in front of it, and what causes it.
  inertia?: string;
};

export const WARDLEY_COMPONENTS: readonly WardleyComponent[] = [
  { id: 'need', label: 'Lunch for the team, on time', evolution: 0.55, visibility: 0.88 },
  { id: 'group', label: 'Group ordering', evolution: 0.33, visibility: 0.74 },
  { id: 'menu', label: 'Menu and dietary filters', evolution: 0.62, visibility: 0.7 },
  { id: 'split', label: 'Split payment', evolution: 0.55, visibility: 0.6 },
  { id: 'restaurants', label: 'Restaurant network', evolution: 0.68, visibility: 0.5 },
  {
    id: 'scheduling',
    label: 'Delivery scheduling',
    evolution: 0.28,
    visibility: 0.47,
    heading: { evolution: 0.5, caption: 'Buy, don’t build' },
  },
  { id: 'payments', label: 'Payments', evolution: 0.84, visibility: 0.42 },
  { id: 'forecasting', label: 'Demand forecasting', evolution: 0.1, visibility: 0.33, play: 1 },
  {
    id: 'routing',
    label: 'Route optimisation',
    evolution: 0.42,
    visibility: 0.27,
    heading: { evolution: 0.78, caption: 'Use a routing API' },
    play: 2,
  },
  {
    id: 'couriers',
    label: 'Courier fleet',
    evolution: 0.64,
    visibility: 0.19,
    inertia: 'Owned van contracts',
    play: 3,
  },
  { id: 'maps', label: 'Maps API', evolution: 0.86, visibility: 0.16 },
  { id: 'cloud', label: 'Cloud compute', evolution: 0.93, visibility: 0.06 },
];

// What needs what: [from, to], the higher component first.
export const WARDLEY_NEEDS: readonly (readonly [string, string])[] = [
  ['need', 'group'],
  ['need', 'menu'],
  ['group', 'split'],
  ['group', 'scheduling'],
  ['menu', 'restaurants'],
  ['split', 'payments'],
  ['restaurants', 'payments'],
  ['scheduling', 'forecasting'],
  ['scheduling', 'routing'],
  ['scheduling', 'couriers'],
  ['routing', 'maps'],
  ['couriers', 'maps'],
  ['payments', 'cloud'],
  ['maps', 'cloud'],
];

// The plays, by number: a verb and what it means here.
export const WARDLEY_PLAYS: readonly { verb: string; text: string }[] = [
  {
    verb: 'Differentiate',
    text: 'Build demand forecasting in-house: it is still Genesis, and the data is ours.',
  },
  {
    verb: 'Outsource',
    text: 'Routing is a commodity now: rent it, and move the team to forecasting.',
  },
  { verb: 'Watch', text: 'Couriers are moving to gig platforms: our van contracts hold us back.' },
];

export const WARDLEY_QUESTIONS: readonly { text: string; done?: boolean }[] = [
  { text: 'Where are we building what we could buy?', done: true },
  { text: 'What will evolve in the next 18 months?' },
  { text: 'Where is our inertia?' },
  { text: 'What can competitors see that we cannot?' },
];
