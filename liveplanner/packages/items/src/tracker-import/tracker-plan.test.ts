import { describe, expect, it } from 'vitest';
import jiraCsv from './fixtures/jira-issues.csv?raw';
import trelloJson from './fixtures/trello-board.json?raw';
import { ITEM_TYPES, type ItemTypeDef } from '../item-types';
import { ITEM_TYPES_MAX } from '../type-catalogue';
import { isTrackerRefusal, readTrackerFile } from './read-tracker-file';
import { csvRows } from './test-csv';
import {
  TRACKER_CARD_COMMENTS_MAX,
  TRACKER_COMMENTS_MAX,
  type TrackerBoard,
  type TrackerCard,
} from './tracker-model';
import {
  TRACKER_NO_STATUS,
  TRACKER_OTHER_COLUMN,
  planTrackerImport,
  type TrackerPlanContext,
} from './tracker-plan';
import { trackerDoneMessage, trackerSummary } from './tracker-preview';
import { trackerCardType } from './tracker-type';

// docs/specs/026-plan/tracker-import.md "What it makes" and "The preview".

const seeded = () => {
  let n = 0;
  return () => (n = (n * 9301 + 49297) % 233280) / 233280;
};

const ctx = (over: Partial<TrackerPlanContext> = {}): TrackerPlanContext => ({
  types: [],
  statuses: [],
  people: [],
  members: [],
  room: 2000,
  boardId: 'board-1',
  random: seeded(),
  ...over,
});

const read = (text: string): TrackerBoard => {
  const b = readTrackerFile(text, csvRows);
  if (isTrackerRefusal(b)) throw new Error(b.refusal);
  return b;
};

const blank = (title: string, column: string, over: Partial<TrackerCard> = {}): TrackerCard => ({
  title,
  column,
  description: '',
  labels: [],
  checklist: [],
  comments: [],
  links: [],
  extras: {},
  ...over,
});

const boardOf = (cards: TrackerCard[], over: Partial<TrackerBoard> = {}): TrackerBoard => ({
  source: 'linear',
  title: 'Imported',
  columns: [],
  cards,
  extras: [],
  skips: {},
  ...over,
});

describe('planning a Trello board into an empty plan', () => {
  const plan = planTrackerImport(read(trelloJson), ctx());

  it('makes a board of the lists with the Trello Card type', () => {
    expect(plan.board.planBoard.columns.map((c) => c.name)).toEqual([
      'Backlog',
      'Doing',
      'In Review',
      'Done',
    ]);
    expect(plan.board.planBoard.addTypes).toEqual(['trello-card']);
    expect(plan.typeIsNew).toBe(true);
    expect(plan.type).toMatchObject({ id: 'trello-card', label: 'Trello Card', glyph: 'kanban' });
    expect(plan.type.fields).toEqual([
      'title',
      'description',
      'status',
      'assignee',
      'priority',
      'start',
      'due',
      'labels',
      'checklist',
      'comments',
      'f-members',
    ]);
    expect(plan.type.custom).toEqual([
      { id: 'f-members', label: 'Members', kind: 'person', multiple: true },
    ]);
    expect(plan.type.statuses).toEqual(plan.board.planBoard.columns.map((c) => c.status));
  });

  it('makes each card in its column with its fields and imported comments', () => {
    expect(plan.creates).toHaveLength(5);
    const hero = plan.creates.find((c) => c.fields['title'] === 'Design the new hero section')!;
    const doing = plan.board.planBoard.columns.find((c) => c.name === 'Doing')!.status;
    expect(hero.place.status).toBe(doing);
    expect(hero.type).toBe('trello-card');
    expect(hero.id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(hero.fields['assignee']).toMatchObject({ id: 'n-ana-lopez', name: 'Ana Lopez' });
    expect(hero.fields['f-members']).toMatchObject([{ id: 'n-ana-lopez' }, { id: 'n-ben-okafor' }]);
    expect(hero.fields['description']).toContain(
      'Attachments\n- hero-v2.png: https://trello.com/1/cards/card-hero/attachments/att-1/download/hero-v2.png',
    );
    expect(hero.importedComments).toEqual([
      {
        text: 'Ben Okafor · 27 Oct 2026\nFirst draft is in Figma.',
        at: Date.parse('2026-10-27T09:05:00.000Z'),
      },
      {
        text: 'Ana Lopez · 29 Oct 2026\nLooks great. @benokafor can you check mobile?',
        at: Date.parse('2026-10-29T15:20:00.000Z'),
      },
    ]);
  });

  it('previews columns, fields, people, comments and what is left out', () => {
    const p = plan.preview;
    expect(p).toMatchObject({
      source: 'trello',
      sourceName: 'Trello',
      title: 'Website Relaunch',
      cards: 5,
      fits: true,
      typeName: 'Trello Card',
      typeIsNew: true,
      people: { matched: 0, onPlan: 0, named: 3 },
      comments: { count: 3, cards: 2 },
    });
    expect(p.columns).toEqual([
      { name: 'Backlog', cards: 2 },
      { name: 'Doing', cards: 1 },
      { name: 'In Review', cards: 1 },
      { name: 'Done', cards: 1 },
    ]);
    expect(p.fields).toContainEqual({ from: 'Card name', to: 'Title', isNew: false, cards: 5 });
    expect(p.fields).toContainEqual({
      from: 'Checklists',
      to: 'Checklist',
      isNew: false,
      cards: 2,
    });
    expect(p.fields).toContainEqual({ from: 'Members', to: 'Members', isNew: true, cards: 3 });
    expect(p.fields.some((f) => f.to === 'Estimate')).toBe(false);
    expect(p.skips).toEqual([
      { reason: 'archivedCards', label: 'Archived cards', count: 2 },
      { reason: 'archivedLists', label: 'Archived lists', count: 1 },
      {
        reason: 'attachmentLinks',
        label: 'Attachments, kept as links in the description',
        count: 1,
      },
      { reason: 'attachmentsNoLink', label: 'Attachments with no link', count: 1 },
    ]);
    expect(trackerSummary(p, 'tab')).toBe('Makes a Board tab with 4 columns and 5 cards.');
    expect(trackerSummary(p, 'plan')).toBe(
      'Makes a new plan with a Board tab of 4 columns and 5 cards.',
    );
    expect(trackerDoneMessage(p, 5)).toBe('Imported 5 cards from Trello, 4 left out');
  });
});

describe('planning into a plan that has people, members and the type', () => {
  const board = read(jiraCsv);
  const first = planTrackerImport(board, ctx());
  const ana = { id: 'u-ana', name: 'Ana L', color: '#2563eb' };
  const ben = { id: 'n-ben-okafor', name: 'Ben Okafor', color: '#16a34a' };

  it('matches a team member by email, someone on the plan by name, and names the rest', () => {
    const b = boardOf([
      blank('One', 'Todo', { assignee: { name: 'Ana Lopez', email: 'ana@example.com' } }),
      blank('Two', 'Todo', { assignee: { name: 'Ben Okafor' } }),
      blank('Three', 'Todo', { assignee: { name: 'Zoe' } }),
      blank('Four', 'Todo', { assignee: { name: 'Zoe' } }),
      blank('Five', 'Todo', { assignee: { name: 'Other', email: 'nobody@example.com' } }),
    ]);
    const plan = planTrackerImport(
      b,
      ctx({ people: [ben], members: [{ email: 'ANA@example.com', person: ana }] }),
    );
    expect(plan.creates.map((c) => (c.fields['assignee'] as { id: string }).id)).toEqual([
      'u-ana',
      'n-ben-okafor',
      'n-zoe',
      'n-zoe',
      'n-other',
    ]);
    expect(plan.preview.people).toEqual({ matched: 1, onPlan: 1, named: 2 });
  });

  it('reuses the type on a second import, sharing statuses by name and merging Choice options', () => {
    const inProgress = { status: 'doing', name: 'In Progress' };
    const own: ItemTypeDef = {
      ...first.type,
      custom: first.type.custom!.map((c) =>
        c.kind === 'choice' ? { ...c, options: ['Epic', 'Bug'] } : c,
      ),
    };
    const again = planTrackerImport(board, ctx({ types: [own], statuses: [inProgress] }));
    expect(again.typeIsNew).toBe(false);
    expect(again.board.planBoard.columns[0]).toMatchObject({
      name: 'In Progress',
      status: 'doing',
    });
    const issueType = again.type.custom!.find((c) => c.label === 'Issue Type')!;
    expect(issueType.options).toEqual(['Epic', 'Bug', 'Story', 'Task']);
    expect(again.type.custom).toHaveLength(own.custom!.length);
    expect(again.preview.fields.find((f) => f.to === 'Issue Type')).toMatchObject({ isNew: false });
    expect(again.preview.typeIsNew).toBe(false);
  });

  it('maps a Choice value the field lacks to nothing and leaves out an extra of another kind', () => {
    const own: ItemTypeDef = {
      ...first.type,
      custom: first.type.custom!.map((c) =>
        c.label === 'Issue Type'
          ? { ...c, options: Array.from({ length: 20 }, (_, i) => `T${i}`) }
          : c.label === 'Sprint'
            ? { ...c, kind: 'number' as const }
            : c,
      ),
    };
    const plan = planTrackerImport(board, ctx({ types: [own] }));
    const issueTypeId = own.custom!.find((c) => c.label === 'Issue Type')!.id;
    expect(plan.creates.every((c) => c.fields[issueTypeId] === undefined)).toBe(true);
    expect(plan.preview.fields.some((f) => f.from === 'Sprint')).toBe(false);
  });

  it('carries Jira comments, the oldest first, from file-named authors', () => {
    const bug = first.creates.find((c) => c.fields['title'] === 'Checkout fails for EU cards')!;
    expect(bug.importedComments.map((c) => c.text.split('\n')[0])).toEqual([
      'Ana Lopez · 12 Mar 2025',
      'Ben Okafor · 13 Mar 2025',
      'Jira user · 14 Mar 2025',
    ]);
    expect(bug.fields['estimate']).toBe(5);
  });
});

describe('columns', () => {
  it('puts a card with no status in No Status, and folds statuses past the cap into Other', () => {
    const names = Array.from({ length: 14 }, (_, i) => `S${i}`);
    const plan = planTrackerImport(
      boardOf([...names.map((n) => blank(`Card ${n}`, n)), blank('Loose', '')], { columns: names }),
      ctx(),
    );
    const columns = plan.board.planBoard.columns.map((c) => c.name);
    expect(columns).toHaveLength(12);
    expect(columns.at(-1)).toBe(TRACKER_OTHER_COLUMN);
    const other = plan.board.planBoard.columns.at(-1)!.status;
    expect(plan.creates.filter((c) => c.place.status === other)).toHaveLength(4);
    expect(plan.preview.skips).toContainEqual({
      reason: 'otherColumn',
      label: 'Cards whose status is folded into Other',
      count: 4,
    });
    expect(plan.preview.columns.at(-1)).toEqual({ name: TRACKER_OTHER_COLUMN, cards: 4 });
  });

  it('keeps a source column named Other as the fold', () => {
    const names = ['Other', ...Array.from({ length: 12 }, (_, i) => `S${i}`)];
    const plan = planTrackerImport(
      boardOf(
        names.map((n) => blank(n, n)),
        { columns: names },
      ),
      ctx(),
    );
    const columns = plan.board.planBoard.columns.map((c) => c.name);
    expect(columns).toHaveLength(11);
    expect(columns[0]).toBe('Other');
  });

  it('names an unnamed column No Status', () => {
    const plan = planTrackerImport(boardOf([blank('A', '  ')]), ctx());
    expect(plan.board.planBoard.columns.map((c) => c.name)).toEqual([TRACKER_NO_STATUS]);
  });
});

describe('caps', () => {
  const comment = (i: number, text = `Comment ${i}`) => ({
    author: 'Ana',
    at: Date.UTC(2026, 0, 1) + i * 60_000,
    text,
  });

  it('keeps a card’s newest 200 comments, oldest first', () => {
    const plan = planTrackerImport(
      boardOf([
        blank('A', 'Todo', { comments: Array.from({ length: 250 }, (_, i) => comment(i)) }),
      ]),
      ctx(),
    );
    const kept = plan.creates[0]!.importedComments;
    expect(kept).toHaveLength(TRACKER_CARD_COMMENTS_MAX);
    expect(kept[0]!.text).toContain('Comment 50');
    expect(kept.at(-1)!.text).toContain('Comment 249');
    expect(plan.preview.skips).toContainEqual({
      reason: 'commentsOverCap',
      label: 'Comments past the cap',
      count: 50,
    });
  });

  it('keeps a thread within its size and the import within its total', () => {
    const long = 'x'.repeat(5000);
    const big = planTrackerImport(
      boardOf([
        blank('A', 'Todo', { comments: Array.from({ length: 100 }, (_, i) => comment(i, long)) }),
      ]),
      ctx(),
    );
    const kept = big.creates[0]!.importedComments;
    expect(kept.length).toBeLessThan(100);
    expect(kept.every((c) => c.text.length <= 2000)).toBe(true);
    expect(JSON.stringify(kept.map((c) => c.text)).length).toBeLessThan(131_072);

    const many = planTrackerImport(
      boardOf(
        Array.from({ length: 101 }, (_, i) =>
          blank(`Card ${i}`, 'Todo', {
            comments: Array.from({ length: 200 }, (_, j) => comment(j)),
          }),
        ),
      ),
      ctx(),
    );
    expect(many.preview.comments.count).toBe(TRACKER_COMMENTS_MAX);
    expect(many.creates.at(-1)!.importedComments).toEqual([]);
  });

  it('says when the plan has no room, never planning part of the file', () => {
    const plan = planTrackerImport(
      boardOf([blank('A', 'Todo'), blank('B', 'Todo')]),
      ctx({ room: 1 }),
    );
    expect(plan.creates).toHaveLength(2);
    expect(plan.preview.fits).toBe(false);
    expect(plan.preview.reason).toBe('This plan has room for 1 more card and this file has 2.');
    const none = planTrackerImport(boardOf([blank('A', 'Todo')]), ctx({ room: -3 }));
    expect(none.preview.reason).toBe('This plan has room for 0 more cards and this file has 1.');
  });

  it('says when the plan’s card types are full', () => {
    const types = Array.from({ length: ITEM_TYPES_MAX }, (_, i) => ({
      ...ITEM_TYPES[0],
      id: `t-${i}`,
      label: `Type ${i}`,
    }));
    const plan = planTrackerImport(boardOf([blank('A', 'Todo')]), ctx({ types }));
    expect(plan.preview.fits).toBe(false);
    expect(plan.preview.reason).toBe(
      "This plan's card types are full, so it can't take the Linear Issue type.",
    );
    expect(trackerCardType('linear', new Set(), [], [], types).fits).toBe(false);
  });

  it('shortens a card too large for its fields, and leaves out one it cannot read', () => {
    const checklist = Array.from({ length: 50 }, (_, i) => ({
      text: `${i} ${'c'.repeat(190)}`,
      done: false,
    }));
    const plan = planTrackerImport(
      boardOf([
        blank('Big', 'Todo', { description: 'd'.repeat(10_000), checklist }),
        blank('Bad', 'Todo', { due: 'not a day' }),
      ]),
      ctx(),
    );
    expect(plan.creates).toHaveLength(1);
    expect(plan.preview.skips.map((s) => s.reason)).toEqual(['shortened', 'invalidCards']);
    expect(trackerDoneMessage(plan.preview, 1)).toBe('Imported 1 card from Linear, 1 left out');
  });

  it('sizes the description with the attachment lines, cut to its limit', () => {
    const links = [{ name: 'a', url: 'https://a.example/' }];
    const plan = planTrackerImport(
      boardOf([
        blank('A', 'Todo', { links }),
        blank('B', 'Todo', { links, description: 'z'.repeat(10_000) }),
      ]),
      ctx(),
    );
    expect(plan.creates[0]!.fields['description']).toBe('Attachments\n- a: https://a.example/');
    expect((plan.creates[1]!.fields['description'] as string).length).toBe(10_000);
  });

  it('throws on a board it cannot place, which reading never makes', () => {
    expect(() =>
      planTrackerImport(boardOf([blank('A', 'Todo')], { title: 'x'.repeat(500) }), ctx()),
    ).toThrow(/board refused/);
  });

  it('plans with Math.random when no random is given', () => {
    const { random: _r, ...rest } = ctx();
    expect(planTrackerImport(boardOf([blank('A', 'Todo')]), rest).creates).toHaveLength(1);
  });
});
