// The words of the Year in Review template (template-builders-year-review.ts): a made-up design
// studio's 2026, specific enough that the user edits it rather than invents it. Pure data.

export const STUDIO = 'Harbour Studio';
export const YEAR = '2026';

// The headline numbers, each on its own pastel card: the card's tint and the ink of its number and
// glyph disc.
export const STATS = [
  {
    value: '42',
    caption: 'projects shipped, our most yet',
    iconId: 'check-circle',
    tint: '#ccfbf1',
    ink: '#0f766e',
  },
  {
    value: '18',
    caption: 'clients, seven of them new',
    iconId: 'users',
    tint: '#e0f2fe',
    ink: '#0369a1',
  },
  {
    value: '1',
    caption: 'app of our own: Tidewater',
    iconId: 'smartphone',
    tint: '#ede9fe',
    ink: '#6d28d9',
  },
  {
    value: '97%',
    caption: 'of clients would hire us again',
    iconId: 'heart',
    tint: '#ffe4e6',
    ink: '#be123c',
  },
  {
    value: '12',
    caption: 'talks and workshops given',
    iconId: 'message',
    tint: '#fef3c7',
    ink: '#b45309',
  },
  {
    value: '3',
    caption: 'awards, including a Webby',
    iconId: 'award',
    tint: '#dcfce7',
    ink: '#15803d',
  },
] as const;

// Projects shipped each quarter (they add up to the 42 above).
export const QUARTERS: readonly (readonly [string, number])[] = [
  ['Q1', 8],
  ['Q2', 11],
  ['Q3', 9],
  ['Q4', 14],
];

// The year's moments, in order, each with its month pill colour and a glyph.
export const MOMENTS = [
  {
    month: 'JAN',
    title: 'Moved into the Harbour Street studio',
    note: 'Big windows, a proper kitchen and room for all eight of us.',
    iconId: 'home',
    color: '#0d9488',
  },
  {
    month: 'MAR',
    title: 'Won the Kestrel Bank rebrand',
    note: 'Our biggest pitch yet, and our first bank.',
    iconId: 'briefcase',
    color: '#0284c7',
  },
  {
    month: 'MAY',
    title: 'Launched Tidewater, our first app',
    note: 'Tide times for 400 harbours, built in twelve weeks.',
    iconId: 'smartphone',
    color: '#7c3aed',
  },
  {
    month: 'JUL',
    title: 'Team retreat in the Lake District',
    note: 'Three days, two hikes and one very competitive quiz.',
    iconId: 'sun',
    color: '#d97706',
  },
  {
    month: 'SEP',
    title: 'Welcomed Mo and Freya',
    note: 'A motion designer and our first full-time researcher.',
    iconId: 'user-plus',
    color: '#db2777',
  },
  {
    month: 'NOV',
    title: 'Tidewater won a Webby',
    note: 'Best Utility App, voted for by the people who use it.',
    iconId: 'award',
    color: '#16a34a',
  },
  {
    month: 'DEC',
    title: 'Shipped project number 42',
    note: 'The Kestrel Bank app went live on the 12th.',
    iconId: 'flag',
    color: '#4f46e5',
  },
] as const;

export const TEAM = 'With love from Ines, Tom, Priya, Kofi, Hannah, Leo, Mo and Freya';
