// The ids a Viewer is not handed (each product's docs/specs/013-workspace/share-roles.md "Ids a Viewer sees", Work
// Tracker 1451): what a Viewer reads, what a copy keeps, and the restore that keeps a save from a Viewer's copy from
// wiping anyone's id.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { collabKeyFor } from './collab-key';
import {
  HIDDEN_PERSON,
  NOBODY,
  copyDataWithoutPeople,
  copyWithoutPeople,
  frameForViewer,
  hidePeople,
  isHiddenPerson,
  isPersonIdShape,
  mayNamePeople,
  ownIdIs,
  ownIdsOfCollabKey,
  peopleForReader,
  restoreHiddenPeople,
  sessionIsViewer,
  viewerOwnIds,
} from './hidden-people';

const ME = 'user_me';
const ALICE = 'user_alice';
const GUEST = 'guest_0f5ca4af-9a8a-4a60-be5e-1179e5555880';
const KEY = 'a'.repeat(32);

const action = (id: string, userId: string | null, assignerId: string, memberId?: string) => ({
  id,
  name: `Do ${id}`,
  description: '',
  assignee: { userId, name: 'Alice', ...(memberId ? { memberId } : {}) },
  teamId: 't1',
  assignerId,
  assignerName: 'Bob',
  status: 'open',
  createdAt: 1,
  updatedAt: 1,
});

// A tab holding every kind of person the rule knows: actions (one and a list), a comment mention, answers, Q&A voters,
// a dot vote and its starter, and a design's component edit session.
const storedTab = () => ({
  id: 'tab1',
  name: 'Board',
  elements: [
    { id: 'e1', type: 'shape', action: action('a1', ALICE, GUEST) },
    {
      id: 'e2',
      type: 'shape',
      actions: [action('a2', ME, ALICE), action('a3', null, ALICE, 'member-7')],
      commentThread: {
        resolved: false,
        comments: [
          {
            id: 'c1',
            text: 'hi @Alice',
            authorName: 'Bob',
            mentions: [{ userId: ALICE, name: 'Alice' }],
          },
        ],
      },
    },
    {
      id: 'e3',
      type: 'shape',
      responses: [
        { participantId: KEY, value: 3, at: 1 },
        { participantId: GUEST, value: 5, at: 2 },
      ],
      qaNotes: [{ id: 'n1', text: 'Why?', at: 1, voters: ['0123456789abcdef', ALICE] }],
    },
    { id: 'e4', type: 'group', componentEditBy: ALICE, x: 1, points: [1, 2, 3] },
  ],
  vote: { votes: { e1: [KEY, GUEST], e3: [KEY] }, startedBy: ALICE },
});

describe('id shapes', () => {
  it('tells an account or guest id from a key', () => {
    expect(isPersonIdShape(ALICE)).toBe(true);
    expect(isPersonIdShape(GUEST)).toBe(true);
    expect(isPersonIdShape(KEY)).toBe(false);
    expect(isPersonIdShape(null)).toBe(false);
    expect(isHiddenPerson(HIDDEN_PERSON)).toBe(true);
    expect(isHiddenPerson('hidden-4')).toBe(true);
    expect(isHiddenPerson('someone-4')).toBe(false);
    expect(isHiddenPerson(3)).toBe(false);
  });
});

describe('hidePeople', () => {
  it('hides every other person a Viewer would be handed, and keeps their own', () => {
    const seen = hidePeople(storedTab(), ownIdIs(ME));
    const [e1, e2, e3, e4] = seen.elements as ReturnType<typeof storedTab>['elements'];
    expect(e1!.action!.assignee.userId).toBe(HIDDEN_PERSON);
    expect(e1!.action!.assignerId).toBe(HIDDEN_PERSON);
    // Names stay: a Viewer reads who, never their id.
    expect(e1!.action!.assignee.name).toBe('Alice');
    expect(e1!.action!.assignerName).toBe('Bob');
    // Their own assignment keeps its id, so For You still finds it.
    expect(e2!.actions![0]!.assignee.userId).toBe(ME);
    expect(e2!.actions![0]!.assignerId).toBe(HIDDEN_PERSON);
    expect(e2!.actions![1]!.assignee.userId).toBeNull();
    expect(e2!.actions![1]!.assignee.memberId).toBe(HIDDEN_PERSON);
    expect(e2!.commentThread!.comments[0]!.mentions[0]!.userId).toBe(HIDDEN_PERSON);
    // A collab key gives nothing away and stays; an old answer under a guest id does not.
    expect(e3!.responses!.map((r) => r.participantId)).toEqual([KEY, 'hidden-1']);
    expect(e3!.qaNotes![0]!.voters).toEqual(['0123456789abcdef', 'hidden-2']);
    expect(e4!.componentEditBy).toBe(HIDDEN_PERSON);
    expect(e4!.points).toEqual([1, 2, 3]);
    expect(seen.vote.votes.e1).toEqual([KEY, 'hidden-3']);
    expect(seen.vote.votes.e3).toEqual([KEY]);
    expect(seen.vote.startedBy).toBe('hidden-4');
  });

  it('hides for a Viewer grant only, keeping the caller own id', () => {
    const tab = storedTab();
    expect(peopleForReader(tab, 'edit', ALICE)).toBe(tab);
    expect(peopleForReader(tab, 'participate', ALICE)).toBe(tab);
    const seen = peopleForReader(tab, 'view', ME);
    expect(JSON.stringify(seen)).not.toContain(ALICE);
    expect(JSON.stringify(seen)).toContain(ME);
    expect(JSON.stringify(peopleForReader(tab, undefined, null))).not.toContain(ME);
  });

  it('hides an own id too when the reader has none', () => {
    const seen = hidePeople(storedTab(), NOBODY);
    expect((seen.elements[1] as { actions: { assignee: { userId: string } }[] }).actions[0]!.assignee.userId).toBe(
      HIDDEN_PERSON,
    );
    expect(ownIdIs(null)(ME)).toBe(false);
  });

  it('hands back the very same object when nobody else is named', () => {
    const plain = {
      id: 'tab1',
      elements: [{ id: 'e1', label: 'user_manual', x: 1, tags: ['a'], responses: [{ participantId: KEY }] }],
      vote: { votes: { e1: [KEY] } },
    };
    expect(hidePeople(plain, NOBODY)).toBe(plain);
    const mine = { id: 'e', action: action('a', ME, ME), assignerId: '' };
    expect(hidePeople(mine, ownIdIs(ME))).toBe(mine);
    // Values that are not text are left alone.
    const odd = { userId: null, voters: 'x', votes: [1], startedBy: 3 };
    expect(hidePeople(odd, NOBODY)).toBe(odd);
  });

  it('reaches people in any room op, whatever its kind', () => {
    const ops = [
      { kind: 'el', tabId: 't', op: { kind: 'update', element: { id: 'e1', action: action('a', ALICE, ALICE) } } },
      { kind: 'tab-meta', tabId: 't', patch: { vote: { votes: { e1: [GUEST] }, startedBy: GUEST } } },
      { kind: 'el-delta', delta: { kind: 'response', participantId: ALICE } },
      { kind: 'vote', voter: GUEST },
      { kind: 'changeset', elementOps: [{ kind: 'add', element: { id: 'x', componentEditBy: GUEST } }] },
    ];
    const text = JSON.stringify(hidePeople(ops, NOBODY));
    expect(text).not.toContain(ALICE);
    expect(text).not.toContain(GUEST);
  });
});

describe('copyWithoutPeople', () => {
  it('clears person fields and keeps counts under neutral keys', () => {
    const copy = copyWithoutPeople(storedTab(), ownIdIs(ME));
    const [e1, e2, e3, e4] = copy.elements as ReturnType<typeof storedTab>['elements'];
    expect(e1!.action!.assignee.userId).toBeNull();
    expect(e1!.action!.assignerId).toBe('');
    expect(e2!.actions![0]!.assignee.userId).toBe(ME);
    expect('memberId' in e2!.actions![1]!.assignee).toBe(false);
    expect('userId' in e2!.commentThread!.comments[0]!.mentions[0]!).toBe(true);
    expect(e3!.responses!.map((r) => r.participantId)).toEqual([KEY, 'someone-1']);
    expect('componentEditBy' in e4!).toBe(false);
    expect(copy.vote.votes.e1).toHaveLength(2);
    expect(JSON.stringify(copy)).not.toMatch(/user_alice|guest_|hidden/);
  });

  it('copies stored data, and leaves data with nobody in it or that does not parse as it is', () => {
    const data = JSON.stringify(storedTab());
    const out = copyDataWithoutPeople(data, ownIdIs(ME));
    expect(out).not.toContain(ALICE);
    expect(out).toContain(ME);
    const plain = JSON.stringify({ elements: [{ id: 'e', x: 1 }] });
    expect(copyDataWithoutPeople(plain, NOBODY)).toBe(plain);
    expect(copyDataWithoutPeople('{"userId": oops', NOBODY)).toBe('{"userId": oops');
    const mine = JSON.stringify({ elements: [{ id: 'e', action: action('a', ME, ME) }] });
    expect(copyDataWithoutPeople(mine, ownIdIs(ME))).toBe(mine);
  });
});

describe('restoreHiddenPeople', () => {
  // The data-loss guard: a Viewer's copy saved whole puts back exactly what was stored.
  it('puts back every id a Viewer copy hid', () => {
    const stored = storedTab();
    const seen = hidePeople(stored, ownIdIs(ME));
    expect(restoreHiddenPeople(seen, stored)).toEqual(stored);
  });

  it('keeps what the save changed while putting the ids back', () => {
    const stored = storedTab();
    const seen = hidePeople(stored, NOBODY) as ReturnType<typeof storedTab>;
    // The save renamed an action, reordered the elements, added an answer and a vote, and dropped e4.
    seen.elements[0]!.action!.name = 'Renamed';
    seen.elements[2]!.responses!.push({ participantId: 'b'.repeat(32), value: 1, at: 3 });
    seen.vote.votes.e3!.push('c'.repeat(32));
    const saved = { ...seen, elements: [seen.elements[2]!, seen.elements[1]!, seen.elements[0]!] };
    const back = restoreHiddenPeople(saved, stored) as ReturnType<typeof storedTab>;
    const byId = new Map(back.elements.map((e) => [e.id, e]));
    expect(byId.get('e1')!.action!.name).toBe('Renamed');
    expect(byId.get('e1')!.action!.assignee.userId).toBe(ALICE);
    expect(byId.get('e1')!.action!.assignerId).toBe(GUEST);
    expect(byId.get('e2')!.actions![0]!.assignee.userId).toBe(ME);
    expect(byId.get('e2')!.actions![1]!.assignee.memberId).toBe('member-7');
    expect(byId.get('e2')!.commentThread!.comments[0]!.mentions[0]!.userId).toBe(ALICE);
    expect(byId.get('e3')!.responses!.map((r) => r.participantId).sort()).toEqual(
      [KEY, GUEST, 'b'.repeat(32)].sort(),
    );
    expect(byId.get('e3')!.qaNotes![0]!.voters).toEqual(['0123456789abcdef', ALICE]);
    expect(back.vote.votes.e1).toEqual([KEY, GUEST]);
    expect(back.vote.votes.e3).toEqual([KEY, 'c'.repeat(32)]);
    expect(back.vote.startedBy).toBe(ALICE);
    expect(JSON.stringify(back)).not.toContain('hidden');
  });

  it('clears a placeholder with nothing stored behind it, so the sentinel is never stored', () => {
    const fresh = {
      elements: [
        { id: 'new', action: action('a9', HIDDEN_PERSON, HIDDEN_PERSON, HIDDEN_PERSON), componentEditBy: 'hidden' },
        { id: 'n2', responses: [{ participantId: 'hidden-1', value: 1, at: 1 }], voters: ['hidden-2'] },
      ],
      vote: { votes: { e1: ['hidden-3'], e2: 'x' }, startedBy: 'hidden-4' },
    };
    const back = restoreHiddenPeople(fresh, null) as unknown as {
      elements: [
        { action: { assignee: Record<string, unknown>; assignerId: string }; componentEditBy?: string },
        { responses: unknown[]; voters: unknown[] },
      ];
      vote: { votes: Record<string, unknown>; startedBy?: string };
    };
    expect(back.elements[0].action.assignee.userId).toBeNull();
    expect('memberId' in back.elements[0].action.assignee).toBe(false);
    expect(back.elements[0].action.assignerId).toBe('');
    expect('componentEditBy' in back.elements[0]).toBe(false);
    expect(back.elements[1].responses).toEqual([]);
    expect(back.elements[1].voters).toEqual([]);
    expect(back.vote.votes).toEqual({ e1: [], e2: 'x' });
    expect('startedBy' in back.vote).toBe(false);
  });

  it('keeps a stored placeholder from a copy when the save brings it back', () => {
    const stored = { elements: [{ id: 'e', voters: ['someone-1', 'hidden-2', GUEST] }] };
    const saved = { elements: [{ id: 'e', voters: ['someone-1', 'hidden-1', 'hidden-2'] }] };
    expect(restoreHiddenPeople(saved, stored).elements[0]!.voters).toEqual(['someone-1', 'hidden-2', GUEST]);
  });

  it('hands back the very same save when it holds no placeholder', () => {
    const save = storedTab();
    expect(restoreHiddenPeople(save, null)).toBe(save);
    // A word that happens to read "hidden" outside a person field changes nothing.
    const tags = { elements: [{ id: 'e', tags: ['hidden'], label: 'hidden' }] };
    expect(restoreHiddenPeople(tags, null)).toEqual(tags);
  });

  // Every save passes through the check, so a large tab with nobody hidden must stay cheap.
  it('checks a 5 000-element save quickly', () => {
    const big = {
      elements: Array.from({ length: 5_000 }, (_, i) => ({
        id: `e${i}`,
        type: 'shape',
        x: i,
        y: i,
        label: `Box ${i}`,
        style: { fill: '#fff', stroke: '#000' },
        points: [1, 2, 3, 4],
        action: action(`a${i}`, ALICE, ALICE),
      })),
    };
    const cpu = cpuMsOf(() => restoreHiddenPeople(big, big));
    expect(cpu).toBeLessThan(cpuBudgetMs(60));
    const hideCpu = cpuMsOf(() => hidePeople(big, NOBODY));
    expect(hideCpu).toBeLessThan(cpuBudgetMs(120));
  });
});

describe('the room', () => {
  it('derives a session own ids from its collab key, as collabKeyFor does', async () => {
    const isOwn = ownIdsOfCollabKey(await collabKeyFor(ME));
    expect(isOwn(ME)).toBe(true);
    expect(isOwn(ME)).toBe(true);
    expect(isOwn(ALICE)).toBe(false);
    expect(isOwn('plain-id')).toBe(false);
    expect(ownIdsOfCollabKey(null)(ME)).toBe(false);
  });

  it('keeps its key cache bounded', () => {
    const isOwn = ownIdsOfCollabKey(KEY);
    for (let i = 0; i < 1_000; i++) expect(isOwn(`user_${i}`)).toBe(false);
  });

  it('reads a session below Participant as a Viewer, never the owner', async () => {
    expect(sessionIsViewer('view')).toBe(true);
    expect(sessionIsViewer(undefined)).toBe(true);
    expect(sessionIsViewer('participate')).toBe(false);
    expect(sessionIsViewer('edit')).toBe(false);
    expect(sessionIsViewer('view', true)).toBe(false);
    expect(viewerOwnIds({ verifiedRole: 'edit' })).toBeNull();
    expect(viewerOwnIds({ verifiedRole: 'participate' })).toBeNull();
    expect(viewerOwnIds({ verifiedRole: 'view', isOwner: true })).toBeNull();
    const own = viewerOwnIds({ verifiedRole: 'view', collabKey: await collabKeyFor(ME) });
    expect(own?.(ME)).toBe(true);
    expect(own?.(ALICE)).toBe(false);
    expect(viewerOwnIds(null)?.(ME)).toBe(false);
  });

  it('passes a frame that names nobody as it was serialised, and hides people in one that does', () => {
    const cursor = { kind: 'op', from: 'p', op: { kind: 'cursor', x: 1 } };
    const text = JSON.stringify(cursor);
    expect(frameForViewer(cursor, text, NOBODY)).toBe(text);
    const roster = { kind: 'presence', participants: [] };
    expect(frameForViewer(roster, 'x', NOBODY)).toBe('x');
    const el = { kind: 'op', from: 'p', op: { kind: 'el', op: { kind: 'update', element: { id: 'e', action: action('a', ALICE, ME) } } } };
    const elText = JSON.stringify(el);
    const out = frameForViewer(el, elText, ownIdIs(ME));
    expect(out).not.toContain(ALICE);
    expect(out).toContain(ME);
    // Their own action: the same frame back.
    const own = { kind: 'op', from: 'p', op: { kind: 'el', op: { element: { id: 'e', action: action('a', ME, ME) } } } };
    const ownText = JSON.stringify(own);
    expect(frameForViewer(own, ownText, ownIdIs(ME))).toBe(ownText);
    expect(mayNamePeople('{"x":1}')).toBe(false);
  });

  // A broadcast tests one frame once per Viewer socket: the scan of a large frame must not grow with the sockets.
  it('scans a large frame once however many Viewers it goes to', () => {
    const big = { kind: 'op', op: { kind: 'tab', tab: { elements: Array.from({ length: 5_000 }, (_, i) => ({ id: `e${i}`, x: i })) } } };
    const text = JSON.stringify(big);
    const cpu = cpuMsOf(() => {
      for (let i = 0; i < 100; i++) frameForViewer(big, text, NOBODY);
    });
    expect(cpu).toBeLessThan(cpuBudgetMs(40));
  });
});
