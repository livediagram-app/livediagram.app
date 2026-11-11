import { describe, expect, it } from 'vitest';
import {
  RETIRED_ELEMENT_NOTE,
  RETIRED_ELEMENT_TYPES,
  RETIRED_SHAPE_NAMES,
  UNKNOWN_ELEMENT_NAME,
  isRetiredElement,
  retiredElementName,
} from './retired-kinds';
import { migrateIncomingElements, migrateIncomingTab, migrateStoredTab } from './stored-tab';
import { migrateStoredElements } from './stored-elements';
import { isValidElement, isValidTab, SHAPE_KINDS } from './validate';
import { elementKindLabel } from './element-kind-label';
import { isKnownElement, kindWordOf } from './element-refs';
import { createShape } from './factories';
import { paintOrder } from './paint-order';
import { resetThemeElement, switchThemeElement } from './themes';
import { THEMES } from './themes-data';
import { normaliseElements } from './element-normalise';
import { elementBounds } from './geometry';
import { isBoxed } from './index';
import { rederiveQuickSwatches } from './quick-swatch-rederive';
import {
  recolourElementsForTheme,
  resetThemeElementsToTheme,
  switchThemeElements,
} from './theme-graph';
import {
  elementSupportsText,
  supportsBorder,
  supportsBorderControls,
  supportsColours,
  supportsFillColor,
} from './index';
import { supportsFinish } from './finish';
import { supportsRotation } from './rotation';
import { retiredArrowBounds } from './retired-arrow';
import type { Element, Tab } from './index';

// docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements": a stored element of a kind livehuddle no
// longer has keeps its kind and every field it carries, through every read path.

const box = (id: string, shape: string, x: number, fields: Record<string, unknown>) => ({
  id,
  type: 'shape',
  shape,
  x,
  y: 40,
  width: 320,
  height: 220,
  label: '',
  ...fields,
});

// Part 5's kinds (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"), by their D29 names.
const PART_5: [string, string][] = [
  ['square', 'Square'],
  ['circle', 'Circle'],
  ['diamond', 'Diamond'],
  ['cylinder', 'Cylinder'],
  ['parallelogram', 'Parallelogram'],
  ['hexagon', 'Hexagon'],
  ['document', 'Document'],
  ['stadium', 'Stadium'],
  ['actor', 'Actor'],
  ['final-state', 'Final State'],
  ['cloud', 'Cloud'],
  ['triangle', 'Triangle'],
  ['trapezoid', 'Trapezoid'],
  ['star', 'Star'],
  ['speech-bubble', 'Speech Bubble'],
];

const answer = (participantId: string, value: string, at = 1_700_000_000_000) => ({
  participantId,
  value,
  at,
});

// One of each deleted kind, carrying the fields it stored.
const RETIRED: Record<string, unknown>[] = [
  box('poll', 'session-button', 0, {
    label: 'Lunch?',
    session: {
      tool: 'poll',
      style: 'choice',
      question: 'Where for lunch?',
      options: ['Tacos', 'Ramen'],
    },
    borderRadius: 'lg',
    textSize: 'sm',
    textBold: true,
  }),
  box('cover', 'reveal', 400, { label: 'Hidden', revealed: true, textAlignY: 'top' }),
  box('pick', 'picker', 800, {
    pickerSource: 'options',
    pickerOptions: ['Ana', 'Bo'],
    pickerResult: 'Bo',
  }),
  box('thread', 'comment-pin', 1200, {
    commentThread: {
      resolved: false,
      comments: [
        { id: 'c1', text: 'Ship it', createdAt: 1, authorName: 'Bea', authorColor: '#f00' },
      ],
    },
  }),
  box('todo', 'action-card', 1600, {
    action: { id: 'a1', assignerId: 'u1', title: 'Write it up' },
  }),
  box('done', 'done-check', 2000, {
    label: 'Everyone done?',
    responses: [answer('k1', 'done'), answer('k2', 'done')],
    collabRound: 'round-2',
  }),
  box('size', 'estimate', 2400, {
    label: 'Login page',
    estimateScale: 'tshirt',
    responses: [answer('k1', 'M'), answer('k2', 'L')],
    responsesRevealed: true,
  }),
  box('mood', 'temperature', 2800, {
    label: 'How are we feeling?',
    responses: [answer('k1', '4'), answer('k2', '2')],
  }),
  box('ideas', 'idea-box', 3200, {
    label: 'Ideas',
    ideaCards: ['More coffee', 'Fewer meetings'],
    ideaCardIds: ['i-1', ''],
    ideasRevealed: false,
  }),
  box('qa', 'qa-board', 3600, {
    label: 'Questions',
    qaNotes: [
      { id: 'n1', text: 'When do we ship?', at: 1, voters: ['k1', 'k2'], state: 'discussing' },
      { id: 'n2', text: 'Who owns it?', at: 2, voters: [], author: { name: 'Sam', color: '#0f0' } },
    ],
    qaRev: 7,
  }),
  box('plan', 'agenda', 4000, {
    label: 'Agenda',
    agendaItems: [
      { label: 'Set the scene', minutes: 5 },
      { label: 'Discuss', minutes: 15 },
    ],
    agendaCurrent: 1,
    agendaTimerStartedAt: 1_700_000_000_000,
  }),
  box('call', 'decision', 4400, {
    label: 'We will use Postgres',
    decisionStatus: 'accepted',
    decisionDate: '2026-03-01',
    decisionDrivers: ['Cost', 'Familiarity'],
    // The fields any element carries ride along too.
    rotation: 10,
    opacity: 0.8,
    shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.18 },
    fillColor: '#fef3c7',
    strokeColor: '#92400e',
  }),
  box('roll', 'roll-call', 4800, {
    label: 'Roll call',
    rollCall: [{ name: 'Ana', color: '#db2777', at: 1 }],
  }),
  box('trivia', 'quiz', 5200, {
    label: 'Which planet is closest to the sun?',
    quizOptions: ['Venus', 'Mercury', 'Mars'],
    quizCorrect: 1,
    quizSeconds: 30,
    quizStartedAt: 1_700_000_000_000,
    quizRevealed: true,
    responses: [answer('k1', '1')],
    aspectLocked: true,
  }),
  // docs/specs/002-project-scope/not-in-livehuddle.md "The presenting tools, Isometric and Zen".
  box('cheer', 'reaction-pad', 5600, {
    label: 'Celebrate',
    reaction: 'fireworks',
    textAlignY: 'bottom',
    borderRadius: 'lg',
  }),
  // docs/specs/002-project-scope/not-in-livehuddle.md "The Frame".
  box('section', 'frame', 6000, {
    label: 'Checkout',
    textAlignX: 'right',
    textAlignY: 'top',
    padding: 'lg',
    fillColor: '#fef3c7',
  }),
  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine": the content widgets.
  box('pie', 'pie-chart', 6400, {
    pieSlices: [
      { label: 'Yes', value: 3 },
      { label: 'No', value: 1 },
    ],
    chartVariant: 'doughnut',
    chartLegendPosition: 'bottom',
  }),
  box('bars', 'bar-chart', 6800, {
    pieSlices: [{ label: 'Q1', value: 4 }],
    chartValues: true,
    chartAxis: true,
  }),
  box('trend', 'line-chart', 7200, {
    lineCategories: ['Mon', 'Tue'],
    lineSeries: [{ label: 'Visits', values: [1, 2] }],
    chartVariant: 'area',
  }),
  box('key', 'legend', 7600, { legendItems: [{ label: 'Done', color: '#16a34a' }] }),
  box('bar', 'progress-bar', 8000, { progress: 40, progressAnim: 'fill' }),
  box('ring', 'progress-ring', 8400, { progress: 75 }),
  box('stars', 'rating', 8800, { rating: 4 }),
  box('snippet', 'code-block', 9200, {
    code: 'const x = 1;',
    codeLanguage: 'ts',
    codeTheme: 'dracula',
    codeWrap: false,
  }),
  box('ticks', 'checklist', 9600, {
    label: 'Launch',
    checklistItems: [
      { text: 'Ship', done: true },
      { text: 'Tell people', done: false },
    ],
  }),
  box('doc', 'page', 10000, { label: 'Notes', pageTitle: 'Notes', pageSubtitle: 'Week 3' }),
  box('hero', 'banner', 10400, { label: 'Welcome', pageSubtitle: 'Say hello' }),
  box('kpis', 'stat-row', 10800, { stats: [{ value: '1.2k', caption: 'Users' }] }),
  box('steps', 'process', 11200, { processSteps: ['Plan', 'Build', 'Ship'] }),
  box('nav', 'site-header', 11600, { label: 'Brand', navLinks: ['Home', 'About'] }),
  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: the layout containers.
  box('swim', 'lane', 12000, {
    label: 'Ops',
    headerFill: '#e0f2fe',
    headerSize: 96,
    titleOrientation: 'upright',
    textAlignX: 'left',
    padding: 'lg',
  }),
  box('row', 'stack', 12400, {
    stackDirection: 'grid',
    stackAlign: 'center',
    stackGap: 12,
    stackPadding: 8,
    stackColumns: 3,
  }),
  box('vpc', 'boundary', 12800, {
    label: 'VPC',
    boundaryStyle: 'c4',
    pageSubtitle: 'eu-west-1',
    iconId: 'cloud',
    animation: 'pulse',
  }),
  box('plan-line', 'timeline-rail', 13200, {
    conceptRows: [
      { label: 'Kick-off', note: 'Jan' },
      { label: 'Launch', note: 'Sep' },
    ],
    conceptAnim: 'build',
    conceptAnimSpeed: 'fast',
    conceptAnimRepeat: true,
  }),
  box('legend-key', 'diagram-key', 13600, {
    label: 'Key',
    keyRows: [
      { id: 'line:dashed', kind: 'line', style: 'dashed' },
      { id: 'tag:pci', kind: 'tag', tag: 'PCI', color: '#e11d48' },
    ],
    keyMeanings: { 'line:dashed': 'Async' },
  }),
  box('svc', 'card', 14000, {
    label: 'Takes card payments.',
    cardMedia: 'tile',
    cardHeader: true,
    iconId: 'credit-card',
    pageTitle: 'Payments',
    pageSubtitle: 'Stripe, EU region',
    tags: ['PCI', 'v2'],
    accentEdge: 'left',
  }),
  box('heads-up', 'callout', 14400, {
    pageTitle: 'Heads up',
    label: 'A short note with some supporting detail.',
  }),
  box('beta', 'badge', 14800, {
    label: 'Beta',
    chipLook: 'tinted',
    attachedTo: 'svc',
    attachAt: 'top-right',
  }),
  box('step-3', 'step', 15200, {
    label: '3',
    attachedTo: 'svc',
    attachAt: 'top-left',
    stepSequence: true,
  }),
  box('why', 'pointer-note', 15600, {
    label: 'Stale for 60 s after a price change',
    pointerTip: { x: -24, y: 120 },
    attachedTo: 'svc',
    attachAt: 'bottom',
    rotation: 15,
  }),
];

const storedTab = (): Tab =>
  structuredClone({
    id: 't1',
    name: 'Retro',
    elements: RETIRED,
  }) as unknown as Tab;

describe('a stored tab of retired elements', () => {
  it('holds one of each deleted kind, none of which livehuddle still has', () => {
    const kinds = RETIRED.map((el) => el.shape as string);
    // Part 5's diagram shapes have a tab of their own below ('a stored diagram shape').
    expect(new Set([...kinds, ...PART_5.map(([kind]) => kind)])).toEqual(
      new Set(Object.keys(RETIRED_SHAPE_NAMES)),
    );
    for (const kind of kinds) expect(SHAPE_KINDS.has(kind), kind).toBe(false);
  });

  it('reads back exactly as stored through migrateStoredTab', () => {
    expect(migrateStoredTab(storedTab())).toEqual(storedTab());
  });

  it('reads back exactly as stored through migrateIncomingTab', () => {
    expect(migrateIncomingTab(storedTab())).toEqual(storedTab());
  });

  it('reads back exactly as stored through the element migrations', () => {
    expect(migrateStoredElements(storedTab().elements)).toEqual(storedTab().elements);
    expect(migrateIncomingElements(storedTab().elements)).toEqual(storedTab().elements);
  });

  it('is a valid tab, each element a valid element', () => {
    expect(isValidTab(storedTab())).toBe(true);
    for (const el of storedTab().elements) expect(isValidElement(el), el.id).toBe(true);
  });

  it('keeps a retired element beside a known one exactly as stored', () => {
    const known = { ...createShape('focus-button', 0, 0), id: 'known' } as Element;
    const tab = { ...storedTab(), elements: [known, ...storedTab().elements] };
    expect(migrateStoredTab(structuredClone(tab)).elements.slice(1)).toEqual(storedTab().elements);
  });

  it('is named to agents by its stored kind', () => {
    const [poll] = storedTab().elements;
    expect(isKnownElement(poll!)).toBe(false);
    expect(kindWordOf(poll!)).toBe('? session-button');
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine": an embed (the `video` type) is a deleted
// element type, kept exactly as stored like a deleted shape kind.
describe('a stored embed', () => {
  const embed = {
    id: 'clip',
    type: 'video',
    x: 0,
    y: 0,
    width: 480,
    height: 270,
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoStart: 30,
  };
  const tab = (): Tab =>
    structuredClone({ id: 't2', name: 'Demo', elements: [embed] }) as unknown as Tab;

  it('is a deleted element type, named Embed', () => {
    expect(RETIRED_ELEMENT_TYPES.has('video')).toBe(true);
    expect(isRetiredElement(embed)).toBe(true);
    expect(retiredElementName(embed)).toBe('Embed');
  });

  it('reads back exactly as stored, and is valid', () => {
    expect(migrateStoredTab(tab())).toEqual(tab());
    expect(migrateIncomingTab(tab())).toEqual(tab());
    expect(isValidTab(tab())).toBe(true);
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 2: a table is a deleted element type,
// kept exactly as stored with its cells, cell styles and cell links, its sizes and its look.
describe('a stored table', () => {
  const table = {
    id: 'grid',
    type: 'table',
    x: 40,
    y: 60,
    width: 360,
    height: 150,
    cells: [
      ['Name', 'Role', 'Room'],
      ['Ada', 'Engineer', 'North'],
      ['Mary', '', 'South'],
    ],
    headerRow: true,
    headerColumn: false,
    zebra: true,
    tablePreset: 'table-banded',
    cellStyles: [
      [{ bold: true, bg: '#e0f2fe' }, null, null],
      [null, { link: { kind: 'url', url: 'https://example.com/ada' } }, null],
      [null, null, { textColor: '#b91c1c', alignX: 'right' }],
    ],
    headerTextColor: '#0f172a',
    headerFill: '#bae6fd',
    colWidths: [120, null, null],
    rowHeights: [null, 60, null],
    textSize: 'md',
    fillColor: '#ffffff',
    strokeColor: '#94a3b8',
    textColor: '#1e293b',
    animation: 'rows',
    commentThread: { id: 'c1', comments: [] },
  };
  const tab = (): Tab =>
    structuredClone({ id: 't3', name: 'Seating', elements: [table] }) as unknown as Tab;

  // A box like any other: the canvas moves, resizes, hit-tests and deletes it by its box (a table read as an arrow
  // threw on its missing ends).
  it('is a box, bounded by what it stored', () => {
    const el = tab().elements[0]!;
    expect(isBoxed(el)).toBe(true);
    expect(elementBounds(el, [el])).toEqual({ x: 40, y: 60, width: 360, height: 150 });
  });

  it('is a deleted element type, named Table', () => {
    expect(RETIRED_ELEMENT_TYPES.has('table')).toBe(true);
    expect(isRetiredElement(table)).toBe(true);
    expect(retiredElementName(table)).toBe('Table');
    expect(elementKindLabel(tab().elements[0]!)).toBe('Table');
  });

  it('loads deep-equal to what was stored, cells, cell styles and links included', () => {
    expect(migrateStoredTab(tab())).toEqual(tab());
    expect(migrateIncomingTab(tab())).toEqual(tab());
    expect(migrateStoredElements(tab().elements)).toEqual(tab().elements);
    expect(migrateIncomingElements(tab().elements)).toEqual(tab().elements);
  });

  it('saves unchanged: a load and a save write back exactly what was read', () => {
    const saved = JSON.parse(JSON.stringify(migrateStoredTab(tab())));
    expect(saved).toEqual(tab());
    expect(migrateStoredTab(saved)).toEqual(tab());
  });

  it('is valid on its box alone', () => {
    expect(isValidTab(tab())).toBe(true);
    expect(isValidElement(table)).toBe(true);
    expect(isValidElement({ ...table, cells: 'not a grid' })).toBe(true);
    expect(isValidElement({ ...table, width: -1 })).toBe(false);
  });

  it('keeps every colour and field through a theme switch, a theme reset and an agent normalise', () => {
    const [grid] = tab().elements;
    expect(switchThemeElement(grid!, THEMES[0]!, THEMES[1]!)).toEqual(table);
    expect(resetThemeElement(grid!, THEMES[1]!)).toEqual(table);
    expect(normaliseElements([grid])).toEqual([table]);
  });

  it('is named to agents by its stored type', () => {
    const [grid] = tab().elements;
    expect(isKnownElement(grid!)).toBe(false);
  });
});

describe('isRetiredElement', () => {
  it('is a shape whose kind livehuddle does not have', () => {
    expect(isRetiredElement({ type: 'shape', shape: 'qa-board' })).toBe(true);
    expect(isRetiredElement({ type: 'shape', shape: 'never-a-kind' })).toBe(true);
    expect(isRetiredElement({ type: 'shape' })).toBe(true);
    expect(isRetiredElement({ type: 'shape', shape: 'square' })).toBe(true);
    expect(isRetiredElement({ type: 'shape', shape: 'focus-button' })).toBe(false);
    expect(isRetiredElement({ type: 'sticky' })).toBe(false);
  });
});

describe('retiredElementName', () => {
  it('names each deleted kind as a person knew it', () => {
    expect(retiredElementName({ shape: 'qa-board' })).toBe('Q&A Board');
    expect(retiredElementName({ shape: 'agenda' })).toBe('Agenda');
    expect(retiredElementName({ shape: 'comment-pin' })).toBe('Comment Panel');
    expect(retiredElementName({ shape: 'action-card' })).toBe('Action Panel');
    expect(retiredElementName({ shape: 'reaction-pad' })).toBe('Reaction Pad');
    expect(retiredElementName({ shape: 'frame' })).toBe('Frame');
    for (const [kind, name] of Object.entries(RETIRED_SHAPE_NAMES)) {
      expect(retiredElementName({ shape: kind }), kind).toBe(name);
    }
  });

  it('names a session button by the tool it started', () => {
    const named = (tool: unknown) =>
      retiredElementName({ shape: 'session-button', session: { tool } });
    expect(named('timer')).toBe('Timer');
    expect(named('stopwatch')).toBe('Stopwatch');
    expect(named('vote')).toBe('Dot Vote');
    expect(named('poll')).toBe('Poll');
    expect(named('launch')).toBe('Session Button');
    expect(named(7)).toBe('Session Button');
    expect(retiredElementName({ shape: 'session-button' })).toBe('Session Button');
  });

  it('calls a kind livehuddle never had an Unknown Element', () => {
    expect(retiredElementName({ shape: 'hologram' })).toBe(UNKNOWN_ELEMENT_NAME);
    expect(retiredElementName({ shape: 'toString' })).toBe(UNKNOWN_ELEMENT_NAME);
    expect(retiredElementName({})).toBe(UNKNOWN_ELEMENT_NAME);
    expect(UNKNOWN_ELEMENT_NAME).toBe('Unknown Element');
    expect(RETIRED_ELEMENT_NOTE).toBe('No longer supported in livehuddle');
  });

  it('is the name a selection caption gives it', () => {
    const quiz = { ...createShape('focus-button', 0, 0), shape: 'quiz' } as unknown as Element;
    expect(elementKindLabel(quiz)).toBe('Quiz');
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The Frame": a stored Frame keeps its place at the back, and what
// sat on it stays put.
describe('a stored Frame', () => {
  const frame = box('section', 'frame', 0, { label: 'Checkout' }) as unknown as Element;
  const member = { ...createShape('focus-button', 40, 80), id: 'member' } as Element;

  it('still paints behind what sat on it, wherever it is in the array', () => {
    expect(paintOrder([member, frame]).map((el) => el.id)).toEqual(['section', 'member']);
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: the layout containers, kept exactly
// as stored, named, and painted where they painted.
describe('a stored layout container', () => {
  const PART_3 = [
    'lane',
    'stack',
    'boundary',
    'timeline-rail',
    'diagram-key',
    'card',
    'callout',
    'badge',
    'step',
    'pointer-note',
  ];
  const stored = (): Element[] =>
    structuredClone(
      RETIRED.filter((el) => PART_3.includes(el.shape as string)),
    ) as unknown as Element[];

  it('is a retired kind, named as a person knew it', () => {
    const names = stored().map((el) => retiredElementName(el));
    expect(names).toEqual([
      'Lane',
      'Stack',
      'Boundary',
      'Timeline',
      'Diagram Key',
      'Card',
      'Callout',
      'Badge',
      'Step Number',
      'Pointer Note',
    ]);
    for (const el of stored()) {
      expect(isRetiredElement(el), el.id).toBe(true);
      expect(elementKindLabel(el), el.id).toBe(retiredElementName(el));
    }
  });

  it('loads and saves deep-equal: no callout becomes a card, no Timeline is rebuilt, no badge settles', () => {
    const tab = { id: 't4', name: 'Map', elements: stored() } as unknown as Tab;
    const saved = JSON.parse(JSON.stringify(migrateStoredTab(structuredClone(tab)))) as Tab;
    expect(saved).toEqual(tab);
    expect(migrateIncomingTab(structuredClone(tab))).toEqual(tab);
    const callout = saved.elements.find((el) => el.id === 'heads-up') as { shape?: string };
    expect(callout.shape).toBe('callout');
    const rail = {
      ...box('old-rail', 'timeline-rail', 0, { railCount: 5, railLabels: ['a', 'b'] }),
    };
    expect(migrateStoredElements([structuredClone(rail)] as unknown as Element[])).toEqual([rail]);
  });

  it('keeps every field through a theme switch, a theme reset and an agent normalise', () => {
    for (const el of stored()) {
      expect(switchThemeElement(el, THEMES[0]!, THEMES[1]!), el.id).toEqual(el);
      expect(resetThemeElement(el, THEMES[1]!), el.id).toEqual(el);
    }
    expect(normaliseElements(stored())).toEqual(stored());
  });

  it('paints a stored lane, stack and boundary at the back, and an attached badge where the array puts it', () => {
    const member = { ...createShape('focus-button', 40, 80), id: 'member' } as Element;
    const [lane, stack, boundary] = stored();
    const badge = stored().find((el) => el.id === 'beta')!;
    expect(paintOrder([member, badge, lane!, stack!, boundary!]).map((el) => el.id)).toEqual([
      'swim',
      'row',
      'vpc',
      'member',
      'beta',
    ]);
  });

  it('is a box, bounded by what it stored, and valid on its box', () => {
    for (const el of stored()) {
      expect(isBoxed(el), el.id).toBe(true);
      expect(isValidElement(el), el.id).toBe(true);
    }
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: an image's hero caption is no longer
// drawn, and the image keeps it exactly as stored.
describe("an image's stored hero caption", () => {
  const hero = {
    id: 'cover',
    type: 'image',
    x: 0,
    y: 0,
    width: 520,
    height: 300,
    imageId: null,
    objectFit: 'cover',
    borderRadius: 'lg',
    heroCaption: { title: 'Welcome', subtitle: 'To the team' },
    fillColor: '#4f46e5',
    textColor: '#ffffff',
  };

  it('loads and saves deep-equal, and the image is still an image', () => {
    const tab = { id: 't5', name: 'Hello', elements: [structuredClone(hero)] } as unknown as Tab;
    const saved = JSON.parse(JSON.stringify(migrateStoredTab(structuredClone(tab))));
    expect(saved).toEqual(tab);
    expect(isRetiredElement(hero)).toBe(false);
    expect(isValidElement(hero)).toBe(true);
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4: arrows, lines, pen and highlighter
// strokes, paths and annotations are deleted element types, each kept exactly as stored (element-engine.md D21 to
// D24).
describe('stored arrows, lines, drawings, paths and annotations', () => {
  const left = {
    id: 'left',
    type: 'shape',
    shape: 'focus-button',
    x: 0,
    y: 0,
    width: 120,
    height: 80,
  };
  const right = {
    id: 'right',
    type: 'shape',
    shape: 'focus-button',
    x: 400,
    y: 0,
    width: 120,
    height: 80,
  };
  const arrow = {
    id: 'flow',
    type: 'arrow',
    from: { kind: 'pinned', elementId: 'left', anchor: 'e' },
    to: { kind: 'pinned', elementId: 'right', anchor: 'w' },
    label: 'Ships to',
    arrowEnds: 'both',
    arrowStyle: 'angled',
    arrowheadShape: 'triangle-hollow',
    arrowheadStartShape: 'diamond',
    arrowheadSize: 'large',
    strokeColor: '#0f172a',
    strokeWidth: 3,
    strokeStyle: 'dashed',
    strokeSwatch: 2,
    curvePoints: [
      { dx: 10, dy: -40 },
      { dx: 30, dy: 40 },
    ],
    elbowOffset: { dx: 0, dy: 12 },
    flow: 'forward',
    flowSpeed: 'fast',
    labelFill: '#ffe4e6',
    labelMaxWidth: 180,
    textSize: 'lg',
    textColor: '#be123c',
    exactEnd: true,
    routeBehind: false,
  };
  const line = {
    id: 'rule',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 300 },
    to: { kind: 'free', x: 500, y: 300 },
    arrowEnds: 'none',
    strokeColor: '#64748b',
  };
  const pen = {
    id: 'pen',
    type: 'freehand',
    x: 20,
    y: 400,
    width: 200,
    height: 80,
    closed: false,
    packedPoints: 'AQAAAAAA',
    pressures: [0.2, 0.8],
    penWidth: 2.5,
    streamline: 0.2,
    penColour: 'blue',
    strokeColor: '#1971c2',
  };
  const highlighter = {
    id: 'glow',
    type: 'freehand',
    x: 260,
    y: 400,
    width: 200,
    height: 20,
    closed: false,
    pen: 'highlighter',
    packedPoints: 'AQAAAAAA',
    strokeColor: '#fde047',
  };
  const path = {
    id: 'curve',
    type: 'path',
    x: 20,
    y: 520,
    width: 160,
    height: 120,
    closed: true,
    nodes: [
      { nx: 0, ny: 0, mode: 'corner' },
      { nx: 1, ny: 0, mode: 'mirrored', handleOut: { nx: 1.2, ny: 0.4 } },
      { nx: 0.5, ny: 1, mode: 'aligned' },
    ],
    subpaths: [
      [
        { nx: 0.2, ny: 0.2, mode: 'corner' },
        { nx: 0.4, ny: 0.2, mode: 'corner' },
        { nx: 0.3, ny: 0.4, mode: 'corner' },
      ],
    ],
    strokeWidth: 'thick',
    fillColor: '#dbeafe',
    penColour: 'teal',
  };
  const annotation = {
    id: 'note',
    type: 'annotation',
    x: 240,
    y: 520,
    width: 44,
    height: 44,
    aspectLocked: true,
    note: 'Check the numbers',
    noteRich: [{ text: 'Check the numbers' }],
    fillColor: '#e0f2fe',
  };
  const STORED = [left, right, arrow, line, pen, highlighter, path, annotation];
  const RETIRED_PART_4 = [arrow, line, pen, highlighter, path, annotation];
  const tab = (): Tab =>
    structuredClone({ id: 't6', name: 'Diagram', elements: STORED }) as unknown as Tab;
  const els = () => tab().elements;

  it('is a retired element, named as a person knew it', () => {
    for (const type of ['freehand', 'path', 'annotation'])
      expect(RETIRED_ELEMENT_TYPES.has(type), type).toBe(true);
    // A stored arrow has two ends rather than a box, so it is retired without being a boxed retired type.
    expect(RETIRED_ELEMENT_TYPES.has('arrow')).toBe(false);
    for (const el of RETIRED_PART_4) expect(isRetiredElement(el), el.id).toBe(true);
    expect(RETIRED_PART_4.map(retiredElementName)).toEqual([
      'Arrow',
      'Line',
      'Drawing',
      'Drawing',
      'Path',
      'Annotation',
    ]);
    expect(els().slice(2).map(elementKindLabel)).toEqual([
      'Arrow',
      'Line',
      'Drawing',
      'Drawing',
      'Path',
      'Annotation',
    ]);
  });

  it('loads deep-equal to what was stored, through every read path', () => {
    expect(migrateStoredTab(tab())).toEqual(tab());
    expect(migrateIncomingTab(tab())).toEqual(tab());
    expect(migrateStoredElements(els())).toEqual(els());
    expect(migrateIncomingElements(els())).toEqual(els());
  });

  it('saves unchanged: a load and a save write back exactly what was read', () => {
    const saved = JSON.parse(JSON.stringify(migrateStoredTab(tab())));
    expect(saved).toEqual(tab());
    expect(migrateStoredTab(saved)).toEqual(tab());
  });

  it('is valid, each element and the tab', () => {
    expect(isValidTab(tab())).toBe(true);
    for (const el of els()) expect(isValidElement(el), el.id).toBe(true);
  });

  it('keeps every colour and field through a theme switch, a theme reset, a recolour, a swatch and a normalise', () => {
    const [from, to] = [THEMES[0]!, THEMES[1]!];
    const retired = els().slice(2);
    for (const el of retired) {
      expect(switchThemeElement(el, from, to), el.id).toEqual(el);
      expect(resetThemeElement(el, to), el.id).toEqual(el);
      expect(rederiveQuickSwatches(el, to), el.id).toBe(el);
    }
    expect(switchThemeElements(els(), from, to).slice(2)).toEqual(retired);
    expect(resetThemeElementsToTheme(els(), to).slice(2)).toEqual(retired);
    expect(recolourElementsForTheme(els(), to).slice(2)).toEqual(retired);
    expect(normaliseElements(els()).slice(2)).toEqual(retired);
  });

  it('is offered no style, text or finish control', () => {
    for (const el of els().slice(2)) {
      expect(supportsColours(el), el.id).toBe(false);
      expect(supportsFillColor(el), el.id).toBe(false);
      expect(supportsBorder(el), el.id).toBe(false);
      expect(supportsBorderControls(el), el.id).toBe(false);
      expect(elementSupportsText(el), el.id).toBe(false);
      expect(supportsFinish(el), el.id).toBe(false);
    }
    // A stored arrow has no box to turn and an annotation never turned; a stored stroke or path keeps the turn it
    // stored, its placeholder drawn at it, as a stored table does.
    expect(
      els()
        .filter(supportsRotation)
        .map((el) => el.id),
    ).toEqual(['left', 'right', 'pen', 'glow', 'curve']);
  });

  it('is named to agents as an unknown kind', () => {
    for (const el of els().slice(2)) {
      expect(isKnownElement(el), el.id).toBe(false);
      expect(kindWordOf(el), el.id).toBe(`? ${el.type}`);
    }
  });

  it('bounds a stored arrow by its line and card, and the boxed ones by their box', () => {
    const all = els();
    const [, , storedArrow, , storedPen] = all;
    expect(isBoxed(storedArrow!)).toBe(false);
    expect(elementBounds(storedArrow!, all)).toEqual(retiredArrowBounds(storedArrow as never, all));
    expect(isBoxed(storedPen!)).toBe(true);
    expect(elementBounds(storedPen!, all)).toEqual({ x: 20, y: 400, width: 200, height: 80 });
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5: the diagram shapes are deleted kinds,
// each kept exactly as stored with every field a person gave it, and named as its palette tile was (DEFAULTS.md D29).
describe('a stored diagram shape', () => {
  const stored = () =>
    PART_5.map(([kind], i) =>
      box(`k${i}`, kind, i * 400, {
        label: `My ${kind}`,
        fillColor: '#fde68a',
        strokeColor: '#b45309',
        textColor: '#1f2937',
        strokeWidth: 'thick',
        strokeStyle: 'dashed',
        borderRadius: 'lg',
        iconId: 'database',
        note: `About the ${kind}`,
        link: { kind: 'url', url: `https://example.com/${kind}` },
        commentThread: {
          resolved: false,
          comments: [
            {
              id: `c${i}`,
              text: 'Looks right',
              createdAt: 1,
              authorName: 'Bea',
              authorColor: '#f00',
            },
          ],
        },
      }),
    ) as unknown as Element[];
  const tab = () => ({ id: 't-p5', name: 'Flow', elements: stored() }) as unknown as Tab;

  it('is every kind part 5 deleted, none of them still a kind', () => {
    for (const [kind] of PART_5) expect(SHAPE_KINDS.has(kind), kind).toBe(false);
    for (const el of stored()) expect(isRetiredElement(el), el.id).toBe(true);
  });

  it('loads deep-equal to what was stored, through every read path', () => {
    expect(migrateStoredTab(tab())).toEqual(tab());
    expect(migrateIncomingTab(tab())).toEqual(tab());
    expect(migrateStoredElements(stored())).toEqual(stored());
    expect(migrateIncomingElements(stored())).toEqual(stored());
  });

  it('saves unchanged: a load and a save write back exactly what was read', () => {
    const saved = JSON.parse(JSON.stringify(migrateStoredTab(tab())));
    expect(saved).toEqual(tab());
    expect(migrateStoredTab(saved)).toEqual(tab());
  });

  it('is valid, each element and the tab', () => {
    expect(isValidTab(tab())).toBe(true);
    for (const el of stored()) expect(isValidElement(el), el.id).toBe(true);
  });

  it('is named as its palette tile was, in the selection caption and on the placeholder', () => {
    stored().forEach((el, i) => {
      expect(retiredElementName(el), el.id).toBe(PART_5[i]![1]);
      expect(elementKindLabel(el), el.id).toBe(PART_5[i]![1]);
      expect(RETIRED_SHAPE_NAMES[PART_5[i]![0]]).toBe(PART_5[i]![1]);
    });
  });

  it('keeps every colour and field through a theme switch, a theme reset, a recolour and a normalise', () => {
    const [from, to] = [THEMES[0]!, THEMES[1]!];
    for (const el of stored()) {
      expect(switchThemeElement(el, from, to), el.id).toEqual(el);
      expect(resetThemeElement(el, to), el.id).toEqual(el);
    }
    expect(switchThemeElements(stored(), from, to)).toEqual(stored());
    expect(resetThemeElementsToTheme(stored(), to)).toEqual(stored());
    expect(recolourElementsForTheme(stored(), to)).toEqual(stored());
    expect(normaliseElements(stored())).toEqual(stored());
  });

  it('is named to agents by its stored kind', () => {
    for (const el of stored()) {
      expect(isKnownElement(el), el.id).toBe(false);
      expect(kindWordOf(el), el.id).toBe(`? ${(el as { shape: string }).shape}`);
    }
  });
});
