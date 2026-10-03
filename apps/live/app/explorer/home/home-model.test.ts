import { describe, expect, it } from 'vitest';
import type {
  HomeGroup,
  HomeJumpBackInItem,
  HomeTimelineEntry,
  HomeTimelineKind,
} from '@livediagram/api-schema';
import { dateKey } from '@livediagram/ui';
import type { LocalOpenDocument } from '@/lib/offline/offline-opens';
import {
  dayHeading,
  foldTimeline,
  groupsByDay,
  homeDocumentHref,
  mergeJumpBackIn,
  stripFade,
  timelineRows,
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

const server = (documentId: string, frecencyKey: number, over: Partial<HomeJumpBackInItem> = {}) =>
  ({ ...place, documentId, lastOpenedAt: 1, openDays: 1, frecencyKey, ...over }) as HomeJumpBackInItem;

const local = (id: string, frecencyKey: number): LocalOpenDocument => ({
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
    savedAt: 7,
    createdAt: 1,
    empty: true,
  },
  opens: { openDays: 1, lastOpenDay: '2026-08-30', lastOpenedAt: 1, frecencyKey },
});

const entry = (
  id: string,
  documentId: string,
  kind: HomeTimelineKind,
  occurredAt: number,
): HomeTimelineEntry => ({ ...place, id, documentId, kind, occurredAt });

describe('homeDocumentHref', () => {
  it('opens own and team documents on their path', () => {
    expect(homeDocumentHref({ documentId: 'd1', via: 'own', shareCode: null })).toBe('/document/d1');
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

describe('mergeJumpBackIn', () => {
  it('ranks local documents among the server ones by frecency key', () => {
    const merged = mergeJumpBackIn([server('s1', 300), server('s2', 100)], [local('l1', 200)]);
    expect(merged.map((d) => [d.documentId, d.localOnly])).toEqual([
      ['s1', false],
      ['l1', true],
      ['s2', false],
    ]);
    expect(merged[1]).toMatchObject({
      name: 'Local l1',
      href: '/document/l1',
      savedAt: 7,
      empty: true,
      shareCode: null,
    });
  });

  it('breaks ties by document id and keeps the strongest twelve', () => {
    const many = Array.from({ length: 13 }, (_, i) => server(`s${String(i).padStart(2, '0')}`, 5));
    const merged = mergeJumpBackIn(many, [local('a', 5)]);
    expect(merged).toHaveLength(12);
    expect(merged[0]!.documentId).toBe('a');
    expect(merged[11]!.documentId).toBe('s10');
  });

  it('carries a shared document’s link and code', () => {
    const [d] = mergeJumpBackIn([server('s1', 1, { via: 'shared', shareCode: 'C' })], []);
    expect(d).toMatchObject({ href: '/document/s1?s=C', shareCode: 'C' });
  });
});

describe('foldTimeline', () => {
  it('keeps one entry per document per day, the strongest kind at its time', () => {
    const folded = foldTimeline(
      [
        entry('e4', 'd1', 'opened', at(30, 14)),
        entry('e3', 'd1', 'updated', at(30, 11)),
        entry('e2', 'd2', 'opened', at(30, 10)),
        entry('e1', 'd1', 'created', at(30, 9)),
        entry('e0', 'd1', 'opened', at(29, 9)),
      ],
      dateKey,
    );
    expect(folded.map((e) => [e.id, e.kind])).toEqual([
      ['e2', 'opened'],
      ['e1', 'created'],
      ['e0', 'opened'],
    ]);
  });

  it('keeps the newest of equal strength, across pages', () => {
    const folded = foldTimeline(
      [entry('e2', 'd1', 'updated', at(30, 12)), entry('e1', 'd1', 'updated', at(30, 8))],
      dateKey,
    );
    expect(folded.map((e) => e.id)).toEqual(['e2']);
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

describe('timelineRows', () => {
  it('puts a day row before each day and alternates sides across days', () => {
    const rows = timelineRows(
      [
        entry('a', 'd1', 'opened', at(30, 14)),
        entry('b', 'd2', 'created', at(29, 14)),
        entry('c', 'd3', 'updated', at(29, 9)),
      ],
      NOW,
    );
    expect(rows.map((r) => (r.type === 'day' ? r.label : `${r.entry.id}:${r.side}`))).toEqual([
      'Today',
      'a:start',
      'Yesterday',
      'b:end',
      'c:start',
    ]);
  });
});

describe('groupsByDay', () => {
  it('groups in the order sent under each day heading', () => {
    const g = (id: string, day: string) => ({ id, day }) as HomeGroup;
    const days = groupsByDay([g('x', '2026-08-30'), g('y', '2026-08-30'), g('z', '2026-08-28')], NOW);
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
