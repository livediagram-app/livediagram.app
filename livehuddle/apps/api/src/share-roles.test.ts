import { describe, expect, it } from 'vitest';
import { applyParticipantOp, type ElementOp, type Tab } from '@livehuddle/document';
import { gateClientOp } from './room-op-gate';
import { claimBaton, FREE_BATON, grantBaton } from './facilitator';

// docs/specs/013-workspace/share-roles.md "Feature by feature (v1)", as the room enforces it: one block per row of the
// table, one case per level. What the room does with an op is one of:
//   relayed  the op reaches the room's peers as sent (presence, an Editor's change, a Participant's own answer)
//   written  a Participant's element op the participant content rule applied to the stored tab
//   held     a Participant's element op the rule took with nothing of it landing (no permitted field changed)
//   refused  a Participant's element op the rule refused, its correction sent back
//   dropped  never relayed, never answered
// REST doors (comments, Q&A notes, tab and document writes) are held per level in routes/context.test.ts and
// routes/comment-routes.test.ts; the room's own plumbing around this gate in document-room*.test.ts.

type Level = 'edit' | 'participate' | 'view';
type Outcome = 'relayed' | 'written' | 'held' | 'refused' | 'dropped';
const LEVELS: readonly Level[] = ['edit', 'participate', 'view'];

const ME = 'me';
const ADDER = 'a'.repeat(32);
const box = { x: 0, y: 0, width: 120, height: 80 };
const shape = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: kind,
  ...box,
  ...extra,
});
const sticky = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'sticky',
  ...box,
  label: 'Idea',
  ...extra,
});
// A Spaces board: Navigate elements (a portal, a chair, a room, a link card), the board's own shape, an Editor's
// sticky and a Participant's own.
const BOARD = {
  id: 't',
  name: 'Office',
  elements: [
    shape('portal', 'portal', { label: 'Kitchen' }),
    shape('chair', 'chair'),
    shape('room', 'room', { label: 'Lounge' }),
    { id: 'link', type: 'link-card', ...box, link: { kind: 'url', url: 'https://example.com' } },
    shape('col', 'rectangle', { label: 'Column' }),
    sticky('theirs'),
    sticky('mine', { addedBy: ADDER }),
  ],
} as unknown as Tab;
const stored = (id: string) => BOARD.elements.find((e) => e.id === id)! as Record<string, unknown>;

const el = (op: Record<string, unknown>) => ({ kind: 'el', tabId: 't', op });
const add = (element: Record<string, unknown>) => el({ kind: 'add', element, at: 0 });
const update = (id: string, change: Record<string, unknown>) =>
  el({ kind: 'update', element: { ...stored(id), ...change } });
const remove = (id: string) => el({ kind: 'remove', id });
const delta = (d: Record<string, unknown>) => ({
  kind: 'el-delta',
  tabId: 't',
  elementId: 'col',
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

describe('share roles in the room (docs/specs/013-workspace/share-roles.md)', () => {
  // Walking writes nothing: the character, its Behaviour, Reaction and Status ride its `avatar` op.
  row(
    'Walk, hop, Behaviours, Reactions, Status',
    {
      walk: { kind: 'avatar', tabId: 't', avatar: { x: 10, y: 20, facing: 'left' } },
      hop: { kind: 'avatar', tabId: 't', avatar: { x: 10, y: 20, hop: 1 } },
      leave: { kind: 'avatar', tabId: 't', avatar: null },
      tab: { kind: 'tab-focus', tabId: 't' },
    },
    EVERYONE,
  );

  row(
    'Speak in a speech bubble',
    { say: { kind: 'avatar-say', tabId: 't', id: 'b1', text: 'Hello', x: 0, y: 0 } },
    TAKING_PART,
  );

  // A shove asks one peer to step aside; sitting and a drink are the character's own state.
  row(
    'Push another character, sit, take a drink',
    {
      push: { kind: 'avatar-push', tabId: 't', to: 'p2', dx: 4, dy: 0 },
      sit: { kind: 'avatar', tabId: 't', avatar: { x: 0, y: 0, seatedOn: 'chair' } },
      drink: { kind: 'avatar', tabId: 't', avatar: { x: 0, y: 0, drink: 'coffee' } },
    },
    EVERYONE,
  );

  row(
    'Go through a portal, follow and be followed',
    {
      portal: { kind: 'tab-focus', tabId: 't2' },
      follow: { kind: 'follow', target: 'p2' },
      followed: { kind: 'viewport', tabId: 't', x: 0, y: 0, zoom: 1 },
    },
    EVERYONE,
  );

  // An Editor's op relays; a Participant's goes through the content rule, which adds none of them, moves none,
  // writes on none and removes none; a Viewer's is dropped.
  describe('Place, move, rename or delete Navigate elements', () => {
    const placeOps = {
      'place a portal': add(shape('p2', 'portal')),
      'place a chair': add(shape('c2', 'chair')),
      'place a room': add(shape('r2', 'room')),
      'place a link card': add({ id: 'l2', type: 'link-card', ...box }),
      'delete a portal': remove('portal'),
      'delete a chair': remove('chair'),
      'delete a link card': remove('link'),
    };
    const reshapeOps = {
      'move a portal': update('portal', { x: 500, y: 500 }),
      'move a chair': update('chair', { x: 500 }),
      'rename a portal': update('portal', { label: 'Exit' }),
      'rename a room': update('room', { label: 'Mine now' }),
      'move a link card': update('link', { x: 500 }),
      'relink a link card': update('link', { link: { kind: 'url', url: 'https://evil.test' } }),
    };
    it('edit: relayed', () => {
      for (const [label, op] of Object.entries({ ...placeOps, ...reshapeOps }))
        expect(roomDoes(op, 'edit'), label).toBe('relayed');
    });
    it('participate: refused, or held with nothing landing', () => {
      for (const [label, op] of Object.entries(placeOps))
        expect(roomDoes(op, 'participate'), label).toBe('refused');
      for (const [label, op] of Object.entries(reshapeOps))
        expect(roomDoes(op, 'participate'), label).toBe('held');
    });
    it('view: dropped', () => {
      for (const [label, op] of Object.entries({ ...placeOps, ...reshapeOps }))
        expect(roomDoes(op, 'view'), label).toBe('dropped');
    });
  });

  // A template lands as the tab's content (a `tab` op), with its document name; a Participant's attempt to add a
  // template's shapes one by one is refused by the rule.
  describe('Make a space or a board from a template', () => {
    const landed = {
      tab: { kind: 'tab', tabId: 't', tab: { id: 't', name: 'Office', elements: [] } },
      name: { kind: 'document-meta', patch: { name: 'Office' } },
    };
    it('edit: relayed', () => {
      for (const op of Object.values(landed)) expect(roomDoes(op, 'edit')).toBe('relayed');
    });
    it("participate: dropped, and a template's shape refused", () => {
      for (const op of Object.values(landed)) expect(roomDoes(op, 'participate')).toBe('dropped');
      expect(roomDoes(add(shape('desk', 'desk')), 'participate')).toBe('refused');
    });
    it('view: dropped', () => {
      for (const op of Object.values(landed)) expect(roomDoes(op, 'view')).toBe('dropped');
    });
  });

  row(
    'Press Bring Focus',
    { focus: { kind: 'focus-here', tabId: 't', at: { x: 0, y: 0 }, zoom: 1 } },
    EDITOR_ONLY,
  );

  row(
    'Start, end, reveal or configure a session tool',
    {
      'start a poll': { kind: 'poll-start', poll: { id: 'p1', question: 'Q', options: ['A'] } },
      'end a poll': { kind: 'poll-end', pollId: 'p1' },
      'start the timer': { kind: 'tab-meta', tabId: 't', patch: { timer: { running: true } } },
      'open a vote': { kind: 'tab-meta', tabId: 't', patch: { vote: { active: true } } },
      'tick the done check': delta({ kind: 'check', index: 0, text: 'a', done: true }),
      'show a drag preview': { kind: 'drag-preview', tabId: 't', ids: ['col'] },
    },
    EDITOR_ONLY,
  );

  // A Participant answers as itself only; the presence answers (a poll answer, a reaction) the room then checks
  // against the running poll.
  row(
    'Take part in a session tool (vote, answer, react)',
    {
      vote: { kind: 'vote', tabId: 't', elementId: 'col', voter: ME, delta: 1 },
      answer: delta({ kind: 'response', participantId: ME, value: '3' }),
      idea: delta({ kind: 'idea', id: 'i1', text: 'More coffee' }),
      'poll answer': { kind: 'poll-answer', pollId: 'p1', value: 'A', key: ME, proof: 'x' },
      react: { kind: 'reaction', tabId: 't', id: 'r1', reaction: 'clap', x: 0, y: 0 },
    },
    TAKING_PART,
  );

  it("Take part: a Participant's vote or answer as somebody else is dropped", () => {
    const asOther = [
      { kind: 'vote', tabId: 't', elementId: 'col', voter: 'you', delta: 1 },
      delta({ kind: 'response', participantId: 'you', value: '3' }),
    ];
    for (const op of asOther) expect(roomDoes(op, 'participate')).toBe('dropped');
  });

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

  // An Editor's op relays; a Participant adds stickies and text, writes on anyone's, moves stickies and removes its
  // own through the rule; a Viewer's is dropped.
  describe('Add, write and arrange stickies and text', () => {
    const ops = {
      'add a sticky': add(sticky('n1')),
      'add text': add({ id: 'n2', type: 'text', ...box, label: 'Note' }),
      'write on a sticky': update('theirs', { label: 'Better idea' }),
      'write on the board': update('col', { label: 'Doing' }),
      'move a sticky': update('theirs', { x: 300, y: 40 }),
      'recolour a sticky': update('theirs', { fillColor: '#fde68a' }),
      'remove its own sticky': remove('mine'),
    };
    it('edit: relayed', () => {
      for (const [label, op] of Object.entries(ops))
        expect(roomDoes(op, 'edit'), label).toBe('relayed');
    });
    it('participate: written', () => {
      for (const [label, op] of Object.entries(ops))
        expect(roomDoes(op, 'participate'), label).toBe('written');
    });
    it("participate: never another's sticky removed, nor the board's shape moved", () => {
      expect(roomDoes(remove('theirs'), 'participate')).toBe('refused');
      expect(roomDoes(update('col', { x: 300 }), 'participate')).toBe('held');
    });
    it('view: dropped', () => {
      for (const [label, op] of Object.entries(ops))
        expect(roomDoes(op, 'view'), label).toBe('dropped');
    });
  });

  // A Participant comments through the comment routes (gateParticipate, routes/comment-routes.test.ts: a
  // Participant link comments, a view link is refused), which write the tab and tell the room; in the room the
  // comment deltas are an Editor's, whose save carries them, and a comment's reaction is whoever may comment's.
  describe('Comment, reply, resolve', () => {
    const thread = {
      comment: delta({ kind: 'comment-add', comment: { id: 'c1', text: 'Hi' } }),
      resolve: delta({ kind: 'comment-resolve', resolved: true }),
      remove: delta({ kind: 'comment-remove', commentId: 'c1' }),
    };
    const react = delta({
      kind: 'comment-react',
      commentId: 'c1',
      emoji: 'eyes',
      by: ME,
      name: 'Me',
      on: true,
    });
    it('edit: relayed', () => {
      for (const op of [...Object.values(thread), react])
        expect(roomDoes(op, 'edit')).toBe('relayed');
    });
    it('participate: reacts in the room, writes through the comment routes', () => {
      expect(roomDoes(react, 'participate')).toBe('relayed');
      for (const op of Object.values(thread)) expect(roomDoes(op, 'participate')).toBe('dropped');
    });
    it('view: dropped', () => {
      for (const op of [...Object.values(thread), react])
        expect(roomDoes(op, 'view')).toBe('dropped');
    });
  });

  // Panning and zooming are the viewport a follower follows; spotlight and export write nothing and send nothing.
  row(
    'Pan, zoom, laser, spotlight, export',
    {
      pan: { kind: 'viewport', tabId: 't', x: 40, y: 0, zoom: 1 },
      zoom: { kind: 'viewport', tabId: 't', x: 0, y: 0, zoom: 2 },
      laser: { kind: 'laser', tabId: 't', x: 1, y: 2 },
      cursor: { kind: 'cursor', tabId: 't', x: 1, y: 2 },
      select: { kind: 'select', tabId: 't', ids: ['col'] },
    },
    EVERYONE,
  );

  describe('Change tabs, the theme, anything on the board else', () => {
    const ops = {
      'rename the tab': { kind: 'tab-meta', tabId: 't', patch: { name: 'Plan' } },
      'change the theme': { kind: 'tab-meta', tabId: 't', patch: { theme: 'mono' } },
      'lock the tab': { kind: 'tab-meta', tabId: 't', patch: { locked: true } },
      'replace the tab': { kind: 'tab', tabId: 't', tab: { id: 't', elements: [] } },
      'rename the document': { kind: 'document-meta', patch: { name: 'Mine' } },
    };
    it('edit: relayed', () => {
      for (const [label, op] of Object.entries(ops))
        expect(roomDoes(op, 'edit'), label).toBe('relayed');
      expect(roomDoes(el({ kind: 'reorder', ids: ['col', 'theirs'] }), 'edit')).toBe('relayed');
    });
    it('participate: dropped, and a reorder or a shape refused', () => {
      for (const [label, op] of Object.entries(ops))
        expect(roomDoes(op, 'participate'), label).toBe('dropped');
      expect(roomDoes(el({ kind: 'reorder', ids: ['col', 'theirs'] }), 'participate')).toBe(
        'refused',
      );
      expect(roomDoes(add(shape('box', 'rectangle')), 'participate')).toBe('refused');
      expect(roomDoes(remove('col'), 'participate')).toBe('refused');
    });
    it('view: dropped', () => {
      for (const [label, op] of Object.entries(ops))
        expect(roomDoes(op, 'view'), label).toBe('dropped');
      expect(roomDoes(el({ kind: 'reorder', ids: ['col'] }), 'view')).toBe('dropped');
    });
  });

  // I2: a level the room does not know reads as a Viewer's, row by row.
  it('treats an unknown level as a Viewer', () => {
    const ops = [
      { kind: 'avatar-say', tabId: 't', id: 'b1', text: 'Hello', x: 0, y: 0 },
      { kind: 'reaction', tabId: 't', id: 'r1', reaction: 'clap', x: 0, y: 0 },
      { kind: 'drag-preview', tabId: 't', ids: ['col'] },
      add(sticky('n1')),
    ];
    for (const op of ops) {
      expect(gateClientOp(op, { role: 'admin', tabScope: null, key: ME })).toEqual({
        kind: 'drop',
      });
    }
    expect(
      gateClientOp(
        { kind: 'avatar', tabId: 't', avatar: null },
        { role: 'admin', tabScope: null, key: ME },
      ),
    ).toEqual({ kind: 'relay', presence: true, participantAnswers: false });
  });
});
