import { describe, expect, it } from 'vitest';
import {
  RETIRED_ELEMENT_NOTE,
  RETIRED_SHAPE_NAMES,
  UNKNOWN_ELEMENT_NAME,
  isRetiredElement,
  retiredElementName,
} from './retired-kinds';
import { migrateIncomingElements, migrateIncomingTab, migrateStoredTab } from './stored-tab';
import { migrateStoredElements } from './stored-elements';
import { coerceShapeKind, isValidElement, isValidTab, SHAPE_KINDS } from './validate';
import { elementKindLabel } from './element-kind-label';
import { isKnownElement, kindWordOf } from './element-refs';
import { createShape } from './factories';
import { paintOrder } from './paint-order';
import { containerContents, isContainer } from './containment';
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
    expect(new Set(kinds)).toEqual(new Set(Object.keys(RETIRED_SHAPE_NAMES)));
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
    const square = { ...createShape('square', 0, 0), id: 'sq' } as Element;
    const tab = { ...storedTab(), elements: [square, ...storedTab().elements] };
    expect(migrateStoredTab(structuredClone(tab)).elements.slice(1)).toEqual(storedTab().elements);
  });

  it('is named to agents by its stored kind', () => {
    const [poll] = storedTab().elements;
    expect(isKnownElement(poll!)).toBe(false);
    expect(kindWordOf(poll!)).toBe('? session-button');
  });
});

// Agent-authored input (the MCP server, the AI panel) naming a deleted kind is made as a square: only a stored
// element keeps its retired kind.
describe('a deleted kind from outside', () => {
  it('coerces to a square', () => {
    for (const kind of Object.keys(RETIRED_SHAPE_NAMES))
      expect(coerceShapeKind(kind), kind).toBe('square');
  });
});

describe('isRetiredElement', () => {
  it('is a shape whose kind livehuddle does not have', () => {
    expect(isRetiredElement({ type: 'shape', shape: 'qa-board' })).toBe(true);
    expect(isRetiredElement({ type: 'shape', shape: 'never-a-kind' })).toBe(true);
    expect(isRetiredElement({ type: 'shape' })).toBe(true);
    expect(isRetiredElement({ type: 'shape', shape: 'square' })).toBe(false);
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
    expect(RETIRED_ELEMENT_NOTE).toBe('Not in livehuddle');
  });

  it('is the name a selection caption gives it', () => {
    const quiz = { ...createShape('square', 0, 0), shape: 'quiz' } as unknown as Element;
    expect(elementKindLabel(quiz)).toBe('Quiz');
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The Frame": a stored Frame keeps its place at the back, and what
// sat on it stays put.
describe('a stored Frame', () => {
  const frame = box('section', 'frame', 0, { label: 'Checkout' }) as unknown as Element;
  const member = { ...createShape('square', 40, 80), id: 'member' } as Element;

  it('still paints behind what sat on it, wherever it is in the array', () => {
    expect(paintOrder([member, frame]).map((el) => el.id)).toEqual(['section', 'member']);
  });

  it('is no longer a container: moving it carries nothing', () => {
    expect(isContainer(frame)).toBe(false);
    expect([...containerContents([frame, member], new Set(['section']))]).toEqual(['section']);
  });
});
