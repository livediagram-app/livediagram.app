import { describe, expect, it } from 'vitest';
import type { HomeGroup, HomeJumpBackInItem } from '@livediagram/api-schema';
import type { LocalOpenDocument } from '@/lib/offline/offline-opens';
import {
  dayHeading,
  groupsByDay,
  homeDocumentHref,
  jumpBackInSet,
  phoneOrder,
  stripFade,
  type JumpBackInSet,
} from './home-model';

// Home's pure view model (docs/specs/013-workspace/blueprints/explorer-home-view.md).

// August: newer ICU writes September "Sept". Local times, so the day maths reads the same in any time zone the suite runs in.
const at = (d: number, h = 12, m = 0) => new Date(2026, 7, d, h, m).getTime();
const NOW = at(30, 15);

const place = {
  name: 'Doc',
  via: 'own' as const,
  shareCode: null,
  tabId: null,
  teamId: null,
  teamName: null,
  folderId: null,
  folderName: null,
  ownerName: null,
  savedAt: 1,
  empty: false,
};

const server = (
  documentId: string,
  useDays: number,
  lastUsedAt: number,
  over: Partial<HomeJumpBackInItem> = {},
) => ({ ...place, documentId, useDays, lastUsedAt, ...over }) as HomeJumpBackInItem;

const local = (
  id: string,
  days: string[],
  lastOpenedAt: number,
  savedAt = 7,
): LocalOpenDocument => ({
  document: {
    id,
    ownerId: 'offline',
    name: `Local ${id}`,
    shareable: false,
    shareCode: null,
    folderId: null,
    teamId: null,
    source: null,
    opensIn: null,
    tabKind: null,
    templateFamily: null,
    savedAt,
    createdAt: 1,
    empty: true,
  },
  opens: { days, lastOpenedAt },
});

const ids = (set: JumpBackInSet) => ({
  mostUsed: set.mostUsed.map((d) => d.documentId),
  recent: set.recent.map((d) => d.documentId),
});

describe('homeDocumentHref', () => {
  it('opens own and team documents on their path', () => {
    expect(homeDocumentHref({ documentId: 'd1', via: 'own', shareCode: null })).toBe(
      '/document/d1',
    );
    expect(homeDocumentHref({ documentId: 'd1', via: 'team', shareCode: null })).toBe(
      '/document/d1',
    );
  });

  it('opens a shared document through its link', () => {
    expect(homeDocumentHref({ documentId: 'd1', via: 'shared', shareCode: 'A b' })).toBe(
      '/document/d1?s=A%20b',
    );
  });
});

describe('jumpBackInSet', () => {
  it('places local documents among the server ones by the same rule', () => {
    const set = jumpBackInSet(
      [server('s1', 9, 10), server('s2', 1, 50), server('s3', 0, 40)],
      [local('l1', ['2026-08-30', '2026-08-29'], 30)],
      NOW,
      2,
    );
    expect(ids(set)).toEqual({ mostUsed: ['s1', 'l1'], recent: ['s2', 's3'] });
    expect(set.mostUsed[1]).toMatchObject({
      name: 'Local l1',
      href: '/document/l1',
      savedAt: 7,
      empty: true,
      shareCode: null,
      localOnly: true,
      useDays: 2,
    });
    expect(set.mostUsed[0]!.localOnly).toBe(false);
  });

  it("counts a local document's days inside the window only, and its save as its last use", () => {
    const set = jumpBackInSet(
      [],
      [local('l1', ['2026-08-30', '2026-06-01'], at(30, 9), at(30, 14))],
      NOW,
    );
    // The window to 30 Aug starts 2 Jun: 1 Jun has fallen out.
    expect(set.mostUsed[0]).toMatchObject({ useDays: 1, lastUsedAt: at(30, 14) });
  });

  it('shows a document that is both most used and recent once, under most used', () => {
    const set = jumpBackInSet(
      [server('a', 5, 100), server('b', 1, 90), server('c', 0, 80)],
      [],
      NOW,
      1,
    );
    expect(ids(set)).toEqual({ mostUsed: ['a'], recent: ['b'] });
  });

  it('breaks ties by document id, wherever the documents come from', () => {
    const set = jumpBackInSet(
      [server('s2', 1, 5), server('s1', 1, 5)],
      [local('a', ['2026-08-30'], 5, 0)],
      NOW,
    );
    expect(ids(set).mostUsed).toEqual(['a', 's1', 's2']);
  });

  it('carries a shared document’s link and code', () => {
    const set = jumpBackInSet([server('s1', 1, 1, { via: 'shared', shareCode: 'C' })], [], NOW);
    expect(set.mostUsed[0]).toMatchObject({ href: '/document/s1?s=C', shareCode: 'C' });
  });
});

describe('phoneOrder', () => {
  const set = (mostUsed: string[], recent: string[]) =>
    jumpBackInSet(
      [
        ...mostUsed.map((id, i) => server(id, 10 - i, 1)),
        ...recent.map((id, i) => server(id, 0, 100 - i)),
      ],
      [],
      NOW,
    );
  const order = (s: JumpBackInSet) =>
    phoneOrder(s).map(({ item, group }) => `${item.documentId}:${group}`);

  it('alternates most used and recent, at most eight', () => {
    expect(order(set(['m1', 'm2', 'm3', 'm4'], ['r1', 'r2', 'r3', 'r4']))).toEqual([
      'm1:mostUsed',
      'r1:recent',
      'm2:mostUsed',
      'r2:recent',
      'm3:mostUsed',
      'r3:recent',
      'm4:mostUsed',
      'r4:recent',
    ]);
  });

  it('lets the rest of the longer group follow when one runs out', () => {
    expect(order(set(['m1'], ['r1', 'r2', 'r3']))).toEqual([
      'm1:mostUsed',
      'r1:recent',
      'r2:recent',
      'r3:recent',
    ]);
    expect(order(set([], ['r1', 'r2']))).toEqual(['r1:recent', 'r2:recent']);
    expect(order(set([], []))).toEqual([]);
  });
});

describe('dayHeading', () => {
  it('says Today, Yesterday, then the date, with a year only when it is not this one', () => {
    expect(dayHeading('2026-08-30', NOW)).toBe('Today');
    expect(dayHeading('2026-08-29', NOW)).toBe('Yesterday');
    expect(dayHeading('2026-08-24', NOW)).toBe('Mon, 24 Aug');
    expect(dayHeading('2025-12-31', NOW)).toBe('Wed, 31 Dec 2025');
  });
});

describe('groupsByDay', () => {
  it('groups in the order sent under each day heading', () => {
    const g = (id: string, day: string) => ({ id, day }) as HomeGroup;
    const days = groupsByDay(
      [g('x', '2026-08-30'), g('y', '2026-08-30'), g('z', '2026-08-28')],
      NOW,
    );
    expect(days.map((d) => [d.label, d.groups.map((x) => x.id)])).toEqual([
      ['Today', ['x', 'y']],
      ['Fri, 28 Aug', ['z']],
    ]);
  });
});

describe('stripFade', () => {
  it('fades only while more lies to the right', () => {
    expect(stripFade({ scrollLeft: 0, clientWidth: 300, scrollWidth: 600 })).toBe(true);
    expect(stripFade({ scrollLeft: 300, clientWidth: 300, scrollWidth: 600 })).toBe(false);
    expect(stripFade({ scrollLeft: 299.5, clientWidth: 300, scrollWidth: 600 })).toBe(false);
    expect(stripFade({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 })).toBe(false);
  });
});
