// The Plan glyph set (docs/specs/026-plan/item-types.md "An item type"): a type's glyph on its cards,
// drawn inline on a 16-unit grid as one stroked path, so a card never waits for an icon catalogue.
// Drawn in the house style (stroke 1.6, round caps and joins in PlanTypeGlyph), not taken from a third-party set.
// Listed category by category (PLAN_GLYPH_CATEGORIES); ids never change or go, so a stored type always draws.

export const PLAN_GLYPHS = {
  // Work
  task: 'M5.2 8.2 7 10l3.8-4M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  story: 'M2.5 3.5h4a2 2 0 0 1 2 2v8a1.5 1.5 0 0 0-1.5-1.5h-4.5ZM13.5 3.5h-4a2 2 0 0 0-1 2',
  bug: 'M5.5 6.5h5v5a2.5 2.5 0 0 1-5 0ZM6 6.5a2 2 0 0 1 4 0M3 8.5h2.5M10.5 8.5H13M3.5 12l2-1M12.5 12l-2-1M8 6.5v7',
  project: 'M8 2 14 5 8 8 2 5ZM2 8l6 3 6-3M2 11l6 3 6-3',
  action: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  epic: 'M1.5 13.5 6 5l3 5 2-3 3.5 6.5Z',
  milestone: 'M8 1.5 12.5 6 8 10.5 3.5 6ZM8 10.5v4',
  release: 'M9.5 2.5c2.5 0 4 1.5 4 4l-5 5-4-4ZM6 9.5l-3 1 1-3M7.5 11l-1 3 3-1M10.8 5.2h.01',
  ticket: 'M2 4.5h12v2a1.5 1.5 0 0 0 0 3v2H2v-2a1.5 1.5 0 0 0 0-3ZM9.5 4.5v7',
  kanban: 'M2.5 2.5h11v11h-11ZM4.5 4.5v5M8 4.5v7M11.5 4.5v3',
  checklist: 'M2 4l1 1 2-2M2 9l1 1 2-2M7 4h7M7 9h7M7 13h7M2.5 13h1',
  inbox: 'M2 9.5 4 3h8l2 6.5v4H2ZM2 9.5h3.5l1 1.5h3l1-1.5H14',
  // People
  person: 'M8 7.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM2.5 14a5.5 5.5 0 0 1 11 0',
  team: 'M6 7a2.25 2.25 0 1 0 0-4.5A2.25 2.25 0 0 0 6 7ZM1.5 13a4.5 4.5 0 0 1 9 0M11 7a2 2 0 1 0 0-4M12.5 9.2A4.5 4.5 0 0 1 14.5 13',
  'user-plus':
    'M6.5 7.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM1.5 14a5 5 0 0 1 10 0M13 4.5v4M11 6.5h4',
  'user-check':
    'M6.5 7.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM1.5 14a5 5 0 0 1 10 0M10.8 6.3l1.2 1.2 2.5-2.5',
  contact:
    'M1.5 3.5h13v9h-13ZM5.5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM3.5 10.5a2 2 0 0 1 4 0M9.5 6h3M9.5 8.5h3',
  crown: 'M2 12.5h12M2.5 10.5 2 4l3.5 3L8 3l2.5 4L14 4l-.5 6.5Z',
  // Communication
  chat: 'M2 3h12v8H6l-3 2.5V11H2Z M5 6h6M5 8.5h4',
  mail: 'M1.5 3.5h13v9h-13ZM1.5 4l6.5 5 6.5-5',
  phone: 'M5.5 1.5h5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1ZM7.3 12h1.4',
  megaphone: 'M2 6.5v3h2.5l6 3.5v-10l-6 3.5ZM4.5 9.5l1 4H7l-.8-3.5M12.5 6.5a2 2 0 0 1 0 3',
  bell: 'M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11ZM6.5 13.5a1.5 1.5 0 0 0 3 0',
  send: 'M14.5 1.5 1.5 7l5 2 2 5Zm0 0L6.5 9',
  video: 'M1.5 4.5h9v7h-9ZM10.5 7l4-2.5v7l-4-2.5',
  at: 'M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm0 0v1a2 2 0 0 0 4 0V8a6.5 6.5 0 1 0-2.5 5.1',
  // Planning
  calendar: 'M2.5 3.5h11v10h-11ZM2.5 6.5h11M5.5 2v3M10.5 2v3',
  flag: 'M3.5 14.5v-12M3.5 2.5h8l-1.8 3 1.8 3h-8',
  clock: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM8 4.5V8l2.5 1.5',
  target:
    'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 8h.01',
  pin: 'M8 14.5S3 9.8 3 6.5a5 5 0 0 1 10 0C13 9.8 8 14.5 8 14.5ZM8 8.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  hourglass:
    'M3.5 1.5h9M3.5 14.5h9M4.5 1.5c0 3.5 3.5 4 3.5 6.5S4.5 11 4.5 14.5M11.5 1.5c0 3.5-3.5 4-3.5 6.5s3.5 3 3.5 6.5',
  repeat: 'M2.5 7V6a2 2 0 0 1 2-2h9l-2-2M13.5 9v1a2 2 0 0 1-2 2h-9l2 2',
  // Ideas and Notes
  note: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z',
  idea: 'M9 1.5 4 9h4l-1 5.5L12 7H8Z',
  bookmark: 'M4 2h8v12l-4-3-4 3Z',
  book: 'M8 4c-1.5-1.3-3.5-1.8-6-1.5v10c2.5-.3 4.5.2 6 1.5 1.5-1.3 3.5-1.8 6-1.5v-10c-2.5-.3-4.5.2-6 1.5Zm0 0v10',
  document: 'M3.5 1.5h6l3 3v10h-9ZM9.5 1.5v3h3M5.5 8h5M5.5 10.5h5',
  pencil: 'M11 2.5 13.5 5 5.5 13l-3 .5.5-3ZM9.5 4 12 6.5',
  lightbulb: 'M6 12h4M6.5 14h3M8 1.5a4.5 4.5 0 0 0-2.5 8.2V12h5V9.7A4.5 4.5 0 0 0 8 1.5Z',
  puzzle:
    'M2.5 4.5h3a1.5 1.5 0 1 1 3 0h3v3a1.5 1.5 0 1 1 0 3v3h-3a1.5 1.5 0 1 0-3 0h-3v-3a1.5 1.5 0 1 0 0-3Z',
  quote: 'M3 9.5h3V13H2.5V9C2.5 6.5 3.5 5 6 4M10 9.5h3V13H9.5V9c0-2.5 1-4 3.5-5',
  // Status and Signals
  star: 'M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6Z',
  heart: 'M8 13.5S2 10 2 6a3 3 0 0 1 6-.8A3 3 0 0 1 14 6c0 4-6 7.5-6 7.5Z',
  risk: 'M8 2 14.5 13.5h-13ZM8 6.5v3.2M8 11.6v.1',
  shield: 'M8 1.5 13.5 3.5v4c0 3.5-2.5 5.8-5.5 7-3-1.2-5.5-3.5-5.5-7v-4Z',
  lock: 'M3.5 7h9v7h-9ZM5.5 7V5a2.5 2.5 0 0 1 5 0v2M8 9.8v1.7',
  eye: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  fire: 'M8 14.5a4.5 4.5 0 0 0 4.5-4.5c0-3-2.5-4.5-3-8-1.5 1.5-2 3-2 4.5-1-.5-1.5-1.5-1.5-2.5C4.5 5.5 3.5 7.5 3.5 10A4.5 4.5 0 0 0 8 14.5Z',
  sparkle: 'M8 1.5c.5 3 2.5 5 6.5 6.5-4 1.5-6 3.5-6.5 6.5-.5-3-2.5-5-6.5-6.5 4-1.5 6-3.5 6.5-6.5Z',
  info: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM8 7.5V11M8 5h.01',
  question:
    'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM6.2 6.2a1.9 1.9 0 0 1 3.6.8c0 1.3-1.8 1.6-1.8 2.8M8 11.7h.01',
  ban: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM3.4 3.4l9.2 9.2',
  trophy:
    'M4.5 2h7v4a3.5 3.5 0 0 1-7 0ZM4.5 3.5h-2a2 2 0 0 0 2 3M11.5 3.5h2a2 2 0 0 1-2 3M8 9.5V12M5 14h6l-.5-2h-5Z',
  // Business
  coin: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM10 5.8C9.6 5.2 8.9 5 8 5c-1.2 0-2 .6-2 1.5S6.8 7.8 8 8s2 .7 2 1.6S9.2 11 8 11c-.9 0-1.6-.3-2-.9M8 4v1M8 11v1',
  chart: 'M2 2v12h12M5 11V8M8 11V5M11 11V7',
  trend: 'M1.5 12 6 7.5l3 3 5.5-5.5M10.5 5h4v4',
  briefcase: 'M1.5 5h13v8.5h-13ZM5.5 5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V5M1.5 9h13',
  cart: 'M1.5 2h2l1.8 8.5h7.7l1.5-6H4.4M6 13.5h.01M12 13.5h.01',
  building:
    'M3 14.5v-12h7v12M10 6.5h3v8M1.5 14.5h13M5 5h.01M8 5h.01M5 8h.01M8 8h.01M5 11h.01M8 11h.01',
  percent:
    'M12.5 3.5l-9 9M4.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM11.5 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  wallet: 'M2 4.5h11a1 1 0 0 1 1 1v8H2.5a.5.5 0 0 1-.5-.5v-9a1.5 1.5 0 0 1 1.5-1.5H12M10.5 9H12',
  // Things
  cube: 'M8 1.5 14 4.5v7L8 14.5 2 11.5v-7ZM2 4.5l6 3 6-3M8 7.5v7',
  gift: 'M2 6h12v2.5H2ZM3 8.5h10v6H3ZM8 6v8.5M8 6S7 2.5 5 3c-1.5.4-1 3 3 3ZM8 6s1-3.5 3-3c1.5.4 1 3-3 3Z',
  wrench:
    'M10.5 2a3.5 3.5 0 0 0-3.3 4.6L2.3 11.5a1.4 1.4 0 0 0 2 2l4.9-4.9A3.5 3.5 0 0 0 14 5.5l-2 2-2-.5-.5-2 2-2a3.5 3.5 0 0 0-1-.5Z',
  code: 'M5.5 4 1.5 8l4 4M10.5 4l4 4-4 4M9 2.5 7 13.5',
  laptop: 'M3 3.5h10v7H3ZM1.5 12.5h13',
  database:
    'M2.5 3.5c0-1.1 2.5-2 5.5-2s5.5.9 5.5 2-2.5 2-5.5 2-5.5-.9-5.5-2Zm0 0v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2',
  cloud: 'M4.5 12.5a3 3 0 0 1-.4-6A4.5 4.5 0 0 1 12.7 6 3.25 3.25 0 0 1 12 12.5Z',
  globe:
    'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM1.5 8h13M8 1.5c1.8 1.8 2.6 4 2.6 6.5S9.8 12.7 8 14.5C6.2 12.7 5.4 10.5 5.4 8S6.2 3.3 8 1.5Z',
  home: 'M2 7 8 2l6 5M3.5 6v8h9V6M6.5 14v-4h3v4',
  key: 'M5.5 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM8 7l5.5-5.5M11 4l2 2M12.5 2.5l1 1',
  leaf: 'M3 13c0-6 4-10.5 10.5-10.5C13.5 9 9 13 3 13Zm0 0 6-6',
  link: 'M6.8 9.2a2.5 2.5 0 0 0 3.5 0l2.5-2.5a2.5 2.5 0 0 0-3.5-3.5l-.9.9M9.2 6.8a2.5 2.5 0 0 0-3.5 0L3.2 9.3a2.5 2.5 0 0 0 3.5 3.5l.9-.9',
} as const;

export type PlanGlyphId = keyof typeof PLAN_GLYPHS;

export const PLAN_GLYPH_IDS = Object.keys(PLAN_GLYPHS) as PlanGlyphId[];

// The glyph picker's groups, in order; every glyph is in exactly one (glyphs.test.ts).
export const PLAN_GLYPH_CATEGORIES: readonly {
  id: string;
  label: string;
  glyphs: readonly PlanGlyphId[];
}[] = [
  {
    id: 'work',
    label: 'Work',
    glyphs: [
      'task',
      'story',
      'bug',
      'project',
      'action',
      'epic',
      'milestone',
      'release',
      'ticket',
      'kanban',
      'checklist',
      'inbox',
    ],
  },
  {
    id: 'people',
    label: 'People',
    glyphs: ['person', 'team', 'user-plus', 'user-check', 'contact', 'crown'],
  },
  {
    id: 'communication',
    label: 'Communication',
    glyphs: ['chat', 'mail', 'phone', 'megaphone', 'bell', 'send', 'video', 'at'],
  },
  {
    id: 'planning',
    label: 'Planning',
    glyphs: ['calendar', 'flag', 'clock', 'target', 'pin', 'hourglass', 'repeat'],
  },
  {
    id: 'ideas',
    label: 'Ideas and Notes',
    glyphs: [
      'note',
      'idea',
      'bookmark',
      'book',
      'document',
      'pencil',
      'lightbulb',
      'puzzle',
      'quote',
    ],
  },
  {
    id: 'signals',
    label: 'Status and Signals',
    glyphs: [
      'star',
      'heart',
      'risk',
      'shield',
      'lock',
      'eye',
      'fire',
      'sparkle',
      'info',
      'question',
      'ban',
      'trophy',
    ],
  },
  {
    id: 'business',
    label: 'Business',
    glyphs: ['coin', 'chart', 'trend', 'briefcase', 'cart', 'building', 'percent', 'wallet'],
  },
  {
    id: 'things',
    label: 'Things',
    glyphs: [
      'cube',
      'gift',
      'wrench',
      'code',
      'laptop',
      'database',
      'cloud',
      'globe',
      'home',
      'key',
      'leaf',
      'link',
    ],
  },
];

// A few words each glyph is found by in the picker's search, besides its own name.
export const PLAN_GLYPH_KEYWORDS: Record<PlanGlyphId, string> = {
  task: 'todo done check work',
  story: 'user story book feature',
  bug: 'defect issue error insect',
  project: 'layers stack portfolio',
  action: 'next step do circle',
  epic: 'mountain big initiative goal',
  milestone: 'diamond deadline marker',
  release: 'rocket launch ship deploy',
  ticket: 'pass support request',
  kanban: 'board columns workflow',
  checklist: 'list steps items',
  inbox: 'tray incoming intake queue',
  person: 'user owner member individual',
  team: 'people group squad users',
  'user-plus': 'add member invite hire',
  'user-check': 'approved verified member',
  contact: 'card customer client id',
  crown: 'leader owner vip king',
  chat: 'comment message talk discussion',
  mail: 'email envelope letter',
  phone: 'mobile call device',
  megaphone: 'announce marketing broadcast',
  bell: 'notification alert reminder',
  send: 'paper plane share submit',
  video: 'camera call meeting record',
  at: 'mention email handle',
  calendar: 'date event schedule day',
  flag: 'marker report priority',
  clock: 'time hour duration',
  target: 'goal objective aim okr',
  pin: 'location map place',
  hourglass: 'timer wait waiting deadline',
  repeat: 'recurring loop cycle routine',
  note: 'sticky memo comment',
  idea: 'bolt lightning spark quick',
  bookmark: 'save saved favourite',
  book: 'read docs guide manual',
  document: 'file page paper doc',
  pencil: 'edit write draft',
  lightbulb: 'idea insight bulb',
  puzzle: 'piece integration plugin',
  quote: 'feedback testimonial quotation',
  star: 'favourite rating featured',
  heart: 'love like favourite',
  risk: 'warning alert triangle danger',
  shield: 'security protect safe',
  lock: 'private secure locked',
  eye: 'view watch visible review',
  fire: 'hot urgent flame',
  sparkle: 'new magic shine ai',
  info: 'information about details',
  question: 'help faq unknown ask',
  ban: 'blocked stop forbidden',
  trophy: 'win award achievement prize',
  coin: 'money dollar cost price',
  chart: 'bar graph metric report',
  trend: 'growth up analytics',
  briefcase: 'business job work case',
  cart: 'shop buy order purchase',
  building: 'company office organisation',
  percent: 'discount rate ratio',
  wallet: 'money budget payment',
  cube: 'box package product',
  gift: 'present reward perk',
  wrench: 'tool fix maintenance settings',
  code: 'developer engineering programming',
  laptop: 'computer device hardware',
  database: 'data storage table',
  cloud: 'hosting server online',
  globe: 'world web international',
  home: 'house office base',
  key: 'access password credentials',
  leaf: 'nature green eco',
  link: 'url chain connect',
};

// A glyph's name for people: its id title-cased, a hyphen a space ("user-plus" is "User Plus").
export function planGlyphLabel(id: string): string {
  return id
    .split('-')
    .map((w) => (w ? `${w[0]!.toUpperCase()}${w.slice(1)}` : w))
    .join(' ');
}

// Whether a search finds a glyph: every word typed starts a word of its name or its keywords.
export function glyphMatches(id: PlanGlyphId, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${planGlyphLabel(id)} ${PLAN_GLYPH_KEYWORDS[id]}`.toLowerCase().split(/\s+/);
  return words.every((w) => hay.some((h) => h.startsWith(w)));
}

// An unknown glyph id draws a plain square.
export const PLAN_GLYPH_FALLBACK = 'M3 3h10v10H3Z';

export function planGlyphPath(id: string | undefined): string {
  return (id && (PLAN_GLYPHS as Record<string, string>)[id]) || PLAN_GLYPH_FALLBACK;
}

export function isPlanGlyphId(id: unknown): id is PlanGlyphId {
  return typeof id === 'string' && Object.hasOwn(PLAN_GLYPHS, id);
}
