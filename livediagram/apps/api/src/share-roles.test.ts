import { describe, expect, it } from 'vitest';
import {
  applyParticipantOp,
  createImage,
  createPinnedArrow,
  createShape,
  createSticky,
  createTable,
  createText,
  type Element,
  type ElementOp,
  type Tab,
} from '@livediagram/document';
import { gateClientOp } from './room-op-gate';
import { claimBaton, FREE_BATON, grantBaton } from './facilitator';

// docs/specs/013-workspace/share-roles.md, as the room enforces it: one block per row of "The levels" and "What a
// Participant changes", one case per level. What the room does with an op is one of:
//   relayed  the op reaches the room's peers as sent (presence, an Editor's change, a Participant's own answer)
//   written  a Participant's element op the participant content rule applied to the stored tab
//   held     a Participant's element op the rule took with nothing of it landing (no permitted field changed)
//   refused  a Participant's element op the rule refused, its correction sent back
//   dropped  never relayed, never answered
// REST doors (comments, tab and document writes) are held per level in routes/context.test.ts and the comment route
// tests; the room's own plumbing around this gate in document-room*.test.ts; the field-by-field rule for every
// element type in packages/document/src/participant-content.leak.test.ts. The editor's half is
// apps/editor/lib/share-roles.test.ts.

type Level = 'edit' | 'participate' | 'view';
type Outcome = 'relayed' | 'written' | 'held' | 'refused' | 'dropped';
const LEVELS: readonly Level[] = ['edit', 'participate', 'view'];

const ME = 'me';
const ADDER = 'a'.repeat(32);
const THEM = 'b'.repeat(32);
const el = (e: unknown) => e as Element;
const at = (e: Element, id: string, extra: Record<string, unknown> = {}) =>
  el({ ...e, id, ...extra });

const node = (id: string, parent: string | undefined, x: number, y: number) =>
  el({
    ...createShape('mind-node', x, y),
    id,
    label: id,
    addedBy: THEM,
    ...(parent ? { mindParentId: parent } : {}),
  });

// One board holding a piece of every kind a row names: the board's own shape, a Behaviour, someone's sticky and
// the Participant's own, text, an image, a table, a data entity, and a mind map with its connector.
const BOARD: Tab = {
  id: 't',
  name: 'Retro',
  elements: [
    at(createShape('square', 0, 0), 'col', { label: 'Column', addedBy: THEM }),
    at(createShape('session-button', 200, 0), 'sb', { label: 'Start', addedBy: THEM }),
    at(createSticky(0, 200), 'theirs', { label: 'Idea', addedBy: THEM }),
    at(createSticky(200, 200), 'mine', { label: 'Mine', addedBy: ADDER }),
    at(createText(0, 400), 'txt', { label: 'Caption', addedBy: THEM }),
    at(createImage(200, 400), 'img', { imageId: 'img-1', addedBy: THEM }),
    at(createTable(400, 400), 'tbl', { addedBy: THEM }),
    at(createShape('entity', 600, 0), 'ent', { label: 'User', addedBy: THEM }),
    node('root', undefined, 0, 600),
    node('kid', 'root', 400, 600),
    at(createPinnedArrow('root', 'e', 'kid', 'w'), 'line', { addedBy: THEM }),
    at(createPinnedArrow('col', 'e', 'theirs', 'w'), 'free-line', { addedBy: THEM }),
    at(createShape('square', 0, 800), 'locked-box', { locked: true, addedBy: THEM }),
  ],
};
const stored = (id: string) =>
  BOARD.elements.find((e) => e.id === id)! as unknown as Record<string, unknown>;

const tableCells = (text: string) =>
  (stored('tbl').cells as string[][]).map((r) => r.map(() => text));
const elOp = (op: ElementOp) => ({ kind: 'el', tabId: 't', op });
const add = (element: Element, place = 0) => elOp({ kind: 'add', element, at: place });
const update = (id: string, change: Record<string, unknown>) =>
  elOp({ kind: 'update', element: el({ ...stored(id), ...change }) });
const remove = (id: string) => elOp({ kind: 'remove', id });
const delta = (d: Record<string, unknown>, elementId = 'col') => ({
  kind: 'el-delta',
  tabId: 't',
  elementId,
  delta: d,
});

// What the room does with `op` from a session at `level`: its gate, then, for a Participant's element op, the
// participant content rule against the stored board.
function roomDoes(op: unknown, level: Level): Outcome {
  const gate = gateClientOp(op, { role: level, tabScope: null, key: ME });
  if (gate.kind === 'drop') return 'dropped';
  if (gate.kind === 'relay') return 'relayed';
  const applied = applyParticipantOp(
    BOARD,
    (op as { op: ElementOp }).op,
    level === 'participate' ? ADDER : null,
  );
  if (applied.result === 'refused') return 'refused';
  return applied.changed ? 'written' : 'held';
}

// One row of the table: every op in `ops` meets the same outcome per level.
function row(name: string, ops: Record<string, unknown>, expected: Record<Level, Outcome>) {
  describe(name, () => {
    for (const level of LEVELS) {
      it(`${level}: ${expected[level]}`, () => {
        for (const [label, op] of Object.entries(ops)) {
          expect(roomDoes(op, level), label).toBe(expected[level]);
        }
      });
    }
  });
}

// An Editor's op relays; a Participant's goes through the content rule; a Viewer's is dropped.
function elementRow(
  name: string,
  ops: Record<string, unknown>,
  participant: 'written' | 'held' | 'refused',
) {
  row(name, ops, { edit: 'relayed', participate: participant, view: 'dropped' });
}

const EVERYONE: Record<Level, Outcome> = {
  edit: 'relayed',
  participate: 'relayed',
  view: 'relayed',
};
const EDITOR_ONLY: Record<Level, Outcome> = {
  edit: 'relayed',
  participate: 'dropped',
  view: 'dropped',
};
const TAKING_PART: Record<Level, Outcome> = {
  edit: 'relayed',
  participate: 'relayed',
  view: 'dropped',
};

describe('share roles in the room: the levels (docs/specs/013-workspace/share-roles.md "The levels")', () => {
  row(
    'Viewer: look, pan, zoom, point, laser, follow and be followed, appear in presence',
    {
      cursor: { kind: 'cursor', tabId: 't', x: 1, y: 2 },
      select: { kind: 'select', tabId: 't', ids: ['col'] },
      laser: { kind: 'laser', tabId: 't', x: 1, y: 2 },
      tab: { kind: 'tab-focus', tabId: 't' },
      viewport: { kind: 'viewport', tabId: 't', pan: { x: 0, y: 0 }, zoom: 1 },
      follow: { kind: 'follow', target: 'p2' },
    },
    EVERYONE,
  );

  // A poll answer and a reaction are taking part: a Participant's, never a Viewer's.
  row(
    'Answer a live poll, react',
    {
      answer: { kind: 'poll-answer', tabId: 't', elementId: 'col', choice: 0 },
      reaction: { kind: 'reaction', tabId: 't', elementId: 'col', reaction: 'clap' },
    },
    TAKING_PART,
  );

  // Dots, responses, ideas and comment reactions are a person's own: they must name the sender's collab key.
  row(
    'Cast a dot, answer a card, drop an idea, react to a comment, as yourself',
    {
      vote: { kind: 'vote', tabId: 't', elementId: 'col', voter: ME, delta: 1 },
      response: delta({ kind: 'response', participantId: ME, value: 3 }),
      idea: delta({ kind: 'idea', text: 'More tea' }),
      reactToComment: delta({ kind: 'comment-react', by: ME, emoji: 'up' }),
    },
    TAKING_PART,
  );

  it('nobody answers as someone else, at any level', () => {
    const forged = [
      { kind: 'vote', tabId: 't', elementId: 'col', voter: 'someone-else', delta: 1 },
      delta({ kind: 'response', participantId: 'someone-else', value: 3 }),
    ];
    for (const level of LEVELS)
      for (const op of forged) expect(roomDoes(op, level), `${level}`).toBe('dropped');
    // A reaction is stamped with the sender's key by the room, so an Editor's relays; a Participant's naming
    // another is dropped.
    const react = delta({ kind: 'comment-react', by: 'someone-else', emoji: 'up' });
    expect(roomDoes(react, 'participate')).toBe('dropped');
  });

  row(
    'Editor: change anything on the drawing, its tabs, its modes and its tools',
    {
      'save a tab': { kind: 'tab', tabId: 't', tab: { id: 't', name: 'Retro', elements: [] } },
      'change a tab setting': { kind: 'tab-meta', tabId: 't', patch: { name: 'Renamed' } },
      'a tab saved': { kind: 'tab-saved', tabId: 't' },
      'rename the document': { kind: 'document-meta', patch: { name: 'Renamed' } },
      'start a poll': { kind: 'poll-start', tabId: 't', elementId: 'col' },
      'end a poll': { kind: 'poll-end', tabId: 't', elementId: 'col' },
    },
    EDITOR_ONLY,
  );

  // A checklist tick is one shared value, not a person's answer: editing.
  row(
    'A checklist tick is editing',
    { tick: delta({ kind: 'check', index: 0, text: 'a', done: true }) },
    EDITOR_ONLY,
  );

  // Bring Focus moves everyone's view: running the session, an Editor's.
  row(
    'Press Bring Focus',
    { focus: { kind: 'focus-here', tabId: 't', at: { x: 0, y: 0 }, zoom: 1 } },
    EDITOR_ONLY,
  );

  row(
    'Show a drag preview',
    { preview: { kind: 'drag-preview', tabId: 't', ids: ['col'] } },
    EDITOR_ONLY,
  );

  describe('Hold the facilitator baton', () => {
    const asker = (role: Level) => ({ presenceId: role, role, isOwner: false });
    it('edit: takes a free baton, and may be handed it', () => {
      expect(claimBaton(FREE_BATON, asker('edit'), 'tok')?.next.holder).toBe('edit');
      expect(grantBaton(FREE_BATON, asker('edit'), asker('edit'), 'tok')).not.toBeNull();
    });
    for (const role of ['participate', 'view'] as const) {
      it(`${role}: never holds it, not even from the owner`, () => {
        expect(claimBaton(FREE_BATON, asker(role), 'tok')).toBeNull();
        const owner = { presenceId: 'o', role: 'edit' as const, isOwner: true };
        expect(grantBaton(FREE_BATON, owner, asker(role), 'tok')).toBeNull();
      });
    }
    it('an unknown level holds it no more than a Viewer', () => {
      const odd = { presenceId: 'x', role: 'admin' as never, isOwner: true };
      expect(claimBaton(FREE_BATON, odd, 'tok')).toBeNull();
    });
  });

  it('an unknown level reads as a Viewer: it relays presence and drops every write', () => {
    const odd = { role: 'admin', tabScope: null, key: ME };
    expect(gateClientOp({ kind: 'cursor', tabId: 't', x: 1, y: 2 }, odd).kind).toBe('relay');
    expect(gateClientOp(add(el(createSticky(0, 0))), odd).kind).toBe('drop');
    expect(gateClientOp({ kind: 'tab-meta', tabId: 't', patch: {} }, odd).kind).toBe('drop');
  });
});

describe('share roles in the room: what a Participant changes', () => {
  // Row 1: take part in session tools (above), never start, end, reveal, clear or configure one.
  row(
    'Start, end, reveal, clear or configure a session tool',
    {
      'start a poll': { kind: 'poll-start', tabId: 't', elementId: 'col' },
      'configure a tool': { kind: 'tab-meta', tabId: 't', patch: { folder: 'Stand-ups' } },
      'press Bring Focus': { kind: 'focus-here', tabId: 't', at: { x: 0, y: 0 }, zoom: 1 },
    },
    EDITOR_ONLY,
  );

  // Row 2: add a sticky, a text element or an image; grow a mind map. Nothing else.
  describe('Add a sticky, text, an image, or a mind branch', () => {
    const adds = {
      sticky: add(el(createSticky(0, 0))),
      text: add(el(createText(0, 0))),
      image: add(el(createImage(0, 0))),
    };
    elementRow('what it may add', adds, 'written');
    it('a mind node with a branch to grow from, with its connector', () => {
      const grown = [
        node('n2', 'kid', 800, 600),
        at(createPinnedArrow('kid', 'e', 'n2', 'w'), 'a2'),
      ];
      const first = applyParticipantOp(
        BOARD,
        { kind: 'add', element: grown[0]!, at: BOARD.elements.length },
        ADDER,
      );
      expect(first.result).toBe('applied');
    });
    elementRow(
      'what it may not add',
      {
        shape: add(el(createShape('square', 0, 0))),
        frame: add(el(createShape('frame', 0, 0))),
        'free connector': add(at(createPinnedArrow('col', 'e', 'theirs', 'w'), 'cx')),
        'a mind node with no branch': add(node('stray', undefined, 0, 0)),
      },
      'refused',
    );
  });

  // Row 3: write on any element: its text. Nothing else of one it did not add; never a Behaviour.
  describe('Write on any element', () => {
    elementRow(
      "write on a sticky, a shape's label, text, a table's cells",
      {
        sticky: update('theirs', { label: 'Better idea' }),
        'a shape': update('col', { label: 'Doing' }),
        text: update('txt', { label: 'New caption' }),
        table: update('tbl', { cells: tableCells('Written') }),
        'an entity label': update('ent', { label: 'Account' }),
      },
      'written',
    );
    elementRow(
      'write on a Behaviour, change an entity, change what it did not add',
      {
        'a Behaviour': update('sb', { label: 'Go' }),
        'an entity field': update('ent', { entityFields: [] }),
        'table structure': update('tbl', { cells: [...tableCells('x'), []] }),
        size: update('col', { width: 999 }),
        style: update('col', { fillColor: '#000000' }),
        rotation: update('col', { rotation: 45 }),
        lock: update('theirs', { locked: true }),
      },
      'held',
    );
  });

  // Row 4: move and resize any sticky or image, recolour any sticky, move any mind node, swap any picture.
  describe('Move, resize, recolour', () => {
    elementRow(
      'anyones sticky and image, any mind node',
      {
        'move a sticky': update('theirs', { x: 300, y: 40 }),
        'resize a sticky': update('theirs', { width: 260 }),
        'recolour a sticky': update('theirs', { fillColor: '#fde68a' }),
        'move an image': update('img', { x: 300 }),
        'resize an image': update('img', { width: 300, height: 200 }),
        'swap an image': update('img', { imageId: 'img-2' }),
        'move a mind node': update('kid', { x: 450 }),
      },
      'written',
    );
    elementRow(
      'anything else, text boxes included',
      {
        'move a shape': update('col', { x: 300 }),
        'resize a shape': update('col', { width: 400 }),
        'move a text box': update('txt', { x: 300 }),
        'resize a text box': update('txt', { width: 400 }),
        'recolour a shape': update('col', { fillColor: '#000000' }),
        'resize a mind node': update('kid', { width: 400 }),
      },
      'held',
    );
  });

  // Row 5: delete what it added, and any mind node with its connector; never someone else's.
  describe('Delete', () => {
    elementRow('its own sticky', { own: remove('mine') }, 'written');
    elementRow('a mind node, with its connector', { node: remove('kid') }, 'written');
    elementRow(
      "someone else's work, a connector or a locked piece",
      {
        'a sticky': remove('theirs'),
        'a shape': remove('col'),
        'a text box': remove('txt'),
        'a free connector': remove('free-line'),
        'a locked piece': remove('locked-box'),
      },
      'refused',
    );
  });

  // Row 6: change anything about what it added, so long as it stays something it could add.
  describe('Change what it added', () => {
    elementRow(
      'its own size, style and text',
      {
        size: update('mine', { width: 250, height: 150 }),
        style: update('mine', { fillColor: '#fde68a', rotation: 0 }),
        text: update('mine', { label: 'Mine, better' }),
      },
      'written',
    );
    elementRow(
      'never a lock or a change of type',
      {
        lock: update('mine', { locked: true }),
      },
      'held',
    );
    elementRow(
      'turn it into another type',
      {
        'a shape': elOp({
          kind: 'update',
          element: el({ ...createShape('square', 0, 0), id: 'mine' }),
        }),
      },
      'refused',
    );
  });

  // Row 6 (never): reorder layers, group, lock, point a connector anywhere but two mind nodes.
  describe('Reshape the board', () => {
    elementRow(
      'reorder layers',
      { reorder: elOp({ kind: 'reorder', ids: ['col', 'theirs'] }) },
      'refused',
    );
    elementRow(
      'group, lock, relink a connector',
      {
        group: update('theirs', { groupId: 'g1' }),
        lock: update('col', { locked: true }),
        relink: update('line', { to: { kind: 'element', elementId: 'col', anchor: 'e' } }),
      },
      'held',
    );
  });

  // Row 7: undo and redo its own changes: the room puts back any part it may not make, as a refusal's correction.
  describe('Undo and redo', () => {
    it('puts back a change it may not make, as the stored element', () => {
      const op = update('col', { width: 999 }).op;
      const r = applyParticipantOp(BOARD, op, ADDER);
      expect(r.result === 'applied' && r.changed).toBe(false);
      const del = applyParticipantOp(BOARD, { kind: 'remove', id: 'theirs' }, ADDER);
      expect(del).toMatchObject({
        result: 'refused',
        correction: { kind: 'add', element: { id: 'theirs' } },
      });
    });
  });

  // Row 8: nothing about tabs, the mode, the theme, the canvas, tidy up or the document's name.
  describe('Tabs, modes, themes, tidy up, the document name', () => {
    row(
      'change them',
      {
        'add a tab': { kind: 'tab', tabId: 't2', tab: { id: 't2', name: 'New', elements: [] } },
        'rename a tab': { kind: 'tab-meta', tabId: 't', patch: { name: 'Renamed' } },
        'change a tab mode': { kind: 'tab-meta', tabId: 't', patch: { mode: 'draw' } },
        'tidy a tab': { kind: 'tab', tabId: 't', tab: { id: 't', name: 'Retro', elements: [] } },
        'rename the document': { kind: 'document-meta', patch: { name: 'Renamed' } },
      },
      EDITOR_ONLY,
    );
  });
});

describe('share roles in the room: a link scoped to one tab keeps to its tab', () => {
  it('drops an Editor’s op naming another tab', () => {
    const op = { kind: 'tab-meta', tabId: 't2', patch: { name: 'x' } };
    expect(gateClientOp(op, { role: 'edit', tabScope: 't', key: ME }).kind).toBe('drop');
  });
});
