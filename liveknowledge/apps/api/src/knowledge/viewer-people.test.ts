import { describe, expect, it } from 'vitest';
import { cpuBudgetMs } from '@liveworkspace/vitest-config/cpu-time';
import { ownIdIs } from '@liveworkspace/api-kit/hidden-people';
import {
  PERSON_TOKEN_PREFIX,
  documentSeen,
  isPersonToken,
  knowledgeSeen,
  opSeen,
  personToken,
  restoreKnowledgePeople,
  seerFor,
  tabSeen,
  viewerSeer,
} from './viewer-people';

// docs/specs/013-workspace/share-roles.md "Ids a Viewer sees" (Work Tracker 1479): a page's people as a Viewer reads
// them, and every save putting them back.

const ALICE = 'user_alice';
const BOB = 'user_bob';
const GUEST = 'guest_00000000-0000-4000-8000-00000000b0b0';

const knowledge = () => ({
  owner: ALICE,
  verifiedAt: 5,
  verifiedBy: BOB,
  context: true as const,
  approval: {
    state: 'approved',
    requestedBy: GUEST,
    requestedAt: 1,
    requestedByName: 'Bright Marlin (Guest)',
    decidedBy: BOB,
    decidedAt: 2,
    decidedByName: 'Bob',
  },
});

const see = viewerSeer('kb', ownIdIs('user_carol'));

describe('personToken', () => {
  it('is the same for one person in one knowledgebase, and different in another or for someone else', () => {
    const token = personToken('kb', ALICE);
    expect(token.startsWith(PERSON_TOKEN_PREFIX)).toBe(true);
    expect(token).toHaveLength(PERSON_TOKEN_PREFIX.length + 16);
    expect(personToken('kb', ALICE)).toBe(token);
    expect(personToken('other', ALICE)).not.toBe(token);
    expect(personToken('kb', BOB)).not.toBe(token);
    expect(isPersonToken(token)).toBe(true);
    expect(isPersonToken(ALICE)).toBe(false);
  });

  it('keeps working past its cache bound', () => {
    const first = personToken('kb-cache', 'user_0');
    for (let i = 1; i < 600; i++) personToken('kb-cache', `user_${i}`);
    expect(personToken('kb-cache', 'user_0')).toBe(first);
  });
});

describe('seerFor', () => {
  it('reads every id for a Participant and an Editor, and hides them from a Viewer or an unknown level', () => {
    expect(seerFor('participate', ALICE, 'kb')).toBeNull();
    expect(seerFor('edit', ALICE, 'kb')).toBeNull();
    expect(seerFor('view', ALICE, 'kb')!(BOB)).toBe(personToken('kb', BOB));
    expect(seerFor(undefined, null, 'kb')!(BOB)).toBe(personToken('kb', BOB));
  });

  it("keeps the reader's own id and anything that is not an id", () => {
    const viewer = seerFor('view', ALICE, 'kb')!;
    expect(viewer(ALICE)).toBe(ALICE);
    expect(viewer('guest:Bright Marlin (Guest)')).toBe('guest:Bright Marlin (Guest)');
    expect(viewer('guest')).toBe('guest');
  });
});

describe('knowledgeSeen', () => {
  it('hands a Viewer stand-ins for every person and keeps the names, the dates and the rest', () => {
    const seen = knowledgeSeen(knowledge(), see);
    expect(seen).toEqual({
      ...knowledge(),
      owner: personToken('kb', ALICE),
      verifiedBy: personToken('kb', BOB),
      approval: {
        ...knowledge().approval,
        requestedBy: personToken('kb', GUEST),
        decidedBy: personToken('kb', BOB),
      },
    });
    const text = JSON.stringify(seen);
    for (const id of [ALICE, BOB, GUEST]) expect(text).not.toContain(id);
  });

  it('answers the same value when it names nobody but the reader', () => {
    const own = { owner: 'user_carol', verifiedAt: 1, verifiedBy: 'guest:Pat (Guest)' };
    expect(knowledgeSeen(own, see)).toBe(own);
    const pending = { approval: { state: 'pending', requestedBy: 'user_carol', requestedAt: 1 } };
    expect(knowledgeSeen(pending, see)).toBe(pending);
    expect(knowledgeSeen(undefined, see)).toBeUndefined();
    expect(knowledgeSeen('odd', see)).toBe('odd');
  });
});

describe('the shapes a page reaches a Viewer in', () => {
  it('a tab, a knowledgebase read and the room ops', () => {
    const tab = { id: 't1', name: 'Deploys', knowledge: knowledge() };
    expect(tabSeen(tab, see).knowledge.owner).toBe(personToken('kb', ALICE));
    const bare = { id: 't2', name: 'None' };
    expect(tabSeen(bare, see)).toBe(bare);

    const doc = { id: 'kb', tabs: [bare, tab] };
    const read = documentSeen(doc, see);
    expect(read.tabs[0]).toBe(bare);
    expect(JSON.stringify(read)).not.toContain(ALICE);
    const plain = { id: 'kb', tabs: [bare] };
    expect(documentSeen(plain, see)).toBe(plain);

    const whole = { kind: 'tab', tabId: 't1', tab };
    expect(JSON.stringify(opSeen(whole, see))).not.toContain(BOB);
    const meta = { kind: 'tab-meta', tabId: 't1', patch: { knowledge: knowledge() } };
    expect(JSON.stringify(opSeen(meta, see))).not.toContain(BOB);
    const named = { kind: 'tab-meta', tabId: 't1', patch: { name: 'Renamed' } };
    expect(opSeen(named, see)).toBe(named);
    const ownTab = { kind: 'tab', tabId: 't2', tab: bare };
    expect(opSeen(ownTab, see)).toBe(ownTab);
    const cursor = { kind: 'cursor', tabId: 't1', x: 1, y: 2 };
    expect(opSeen(cursor, see)).toBe(cursor);
    expect(opSeen(null, see)).toBeNull();
  });
});

describe('restoreKnowledgePeople', () => {
  // The data-loss guard: a page saved from a Viewer's copy stores every id it was read with.
  it('puts every stand-in back from the stored page', () => {
    const stored = { id: 't1', knowledge: knowledge() };
    const copy = tabSeen(stored, see);
    expect(restoreKnowledgePeople(copy, stored)).toEqual(stored);
  });

  it('drops a stand-in with nothing stored behind it, and an approval left without its asker', () => {
    const copy = tabSeen({ id: 't1', knowledge: knowledge() }, see);
    const restored = restoreKnowledgePeople(copy, null);
    expect(restored.knowledge).toEqual({ verifiedAt: 5, context: true });
    expect(JSON.stringify(restored)).not.toContain(PERSON_TOKEN_PREFIX);
    // A decider with nothing behind it goes on its own; the asker stays.
    const partly = restoreKnowledgePeople(copy, {
      knowledge: { approval: { requestedBy: GUEST, decidedBy: personToken('kb', BOB) } },
    });
    expect(partly.knowledge.approval).toEqual({
      ...knowledge().approval,
      requestedBy: GUEST,
      decidedBy: undefined,
    });
    expect(partly.knowledge.approval).not.toHaveProperty('decidedBy');
  });

  it('answers a save with no stand-in as it came', () => {
    const tab = { id: 't1', knowledge: knowledge() };
    expect(restoreKnowledgePeople(tab, null)).toBe(tab);
    const bare = { id: 't1' };
    expect(restoreKnowledgePeople(bare, { knowledge: knowledge() })).toBe(bare);
    expect(restoreKnowledgePeople(null, null)).toBeNull();
  });
});

describe('cost', () => {
  it('a knowledgebase read of 1,000 pages for a Viewer, and a room op stream that carries no page', () => {
    const doc = {
      id: 'kb',
      tabs: Array.from({ length: 1000 }, (_, i) => ({
        id: `t${i}`,
        name: `Page ${i}`,
        knowledge: { ...knowledge(), owner: `user_${i % 50}` },
      })),
    };
    const start = process.cpuUsage();
    const read = documentSeen(doc, viewerSeer('kb-cost', ownIdIs(null)));
    const ops = { kind: 'cursor', tabId: 't1', x: 1, y: 1 };
    for (let i = 0; i < 10_000; i++) opSeen(ops, see);
    const spent = process.cpuUsage(start);
    const ms = (spent.user + spent.system) / 1000;
    console.info('[viewer-people] 1,000 pages and 10,000 ops in', ms.toFixed(2), 'ms CPU');
    expect(read.tabs).toHaveLength(1000);
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });
});
