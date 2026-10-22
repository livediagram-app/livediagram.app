import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from './board';
import {
  boardCsvFileName,
  boardCsvImport,
  boardCsvMessage,
  boardCsvRows,
  boardTakesCsv,
  cardDateOf,
  multiChoiceOf,
  type BoardCsvImportContext,
} from './board-csv';
import type { Item } from './item';
import type { ItemTypeDef } from './item-types';
import { ITEM_DESCRIPTION_MAX, ITEM_LABELS_MAX, ITEM_TITLE_MAX } from './limits';
import { ALI, SAM, item } from './test-items';

// A board's CSV (docs/specs/026-plan/plan-board.md "CSV").

const task: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#71717a',
  fields: [
    'title',
    'status',
    'assignee',
    'priority',
    'start',
    'due',
    'estimate',
    'labels',
    'description',
    'parent',
    'f-team',
    'f-size',
    'f-ok',
    'f-on',
  ],
  custom: [
    { id: 'parent', label: 'Parent', kind: 'card', linkType: 'task' },
    { id: 'f-team', label: 'Team', kind: 'choice', options: ['Web', 'Mobile'] },
    { id: 'f-size', label: 'Size', kind: 'number' },
    { id: 'f-ok', label: 'Signed Off', kind: 'checkbox' },
    { id: 'f-on', label: 'Launch', kind: 'date' },
  ],
};
const bug: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'priority', 'f-sev'],
  custom: [{ id: 'f-sev', label: 'Severity', kind: 'text' }],
  excludedStatuses: ['todo'],
};
const note: ItemTypeDef = { ...bug, id: 'note', label: 'Note', custom: [], excludedStatuses: [] };
const types = [task, bug, note];

const setup: PlanBoardSetup = {
  title: 'Roadmap',
  columns: [
    { id: 'c1', status: 'todo', name: 'To Do' },
    { id: 'c2', status: 'doing', name: 'In Progress' },
    { id: 'c3', status: 'done', name: '' },
  ],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
  addTypes: ['task', 'bug'],
};

const mapOf = (items: Item[]) => new Map(items.map((i) => [i.id, i]));

describe('boardCsvFileName', () => {
  it('is the board title, made safe, or Board', () => {
    expect(boardCsvFileName('Roadmap')).toBe('Roadmap.csv');
    expect(boardCsvFileName('Q3: a/b')).toBe('Q3  a b.csv');
    expect(boardCsvFileName('  ')).toBe('Board.csv');
  });
});

describe('boardCsvRows', () => {
  const parent = item({ title: 'Epic', status: 'doing' }, { rank: 'a' });
  const first = item(
    {
      title: 'Ship it, "now"',
      status: 'todo',
      assignee: SAM,
      priority: 'high',
      start: '2026-10-01',
      due: '2026-10-11',
      estimate: 5,
      labels: ['web', 'q3'],
      description: 'Line one\nline two',
      parent: parent.id,
      'f-team': 'Web',
      'f-size': 3,
      'f-ok': true,
    },
    { rank: 'b' },
  );
  const second = item({ title: 'Earlier', status: 'todo' }, { rank: 'a' });
  const crash = item(
    { title: 'Crash', status: 'done', priority: 'urgent', 'f-sev': 'S1' },
    { type: 'bug' },
  );
  const hiddenNote = item({ title: 'Not shown', status: 'todo' }, { type: 'note' });
  const unplaced = item({ title: 'Nowhere', status: 'elsewhere' });
  const trashed = item({ title: 'Gone', status: 'trash' });
  const items = mapOf([parent, first, second, crash, hiddenNote, unplaced, trashed]);

  it('writes a header of Key, Title, Type, Status, the types’ built-ins and custom fields by label', () => {
    expect(boardCsvRows(setup, items, types)[0]).toEqual([
      'Key',
      'Title',
      'Type',
      'Status',
      'Assignee',
      'Priority',
      'Start',
      'Due',
      'Estimate',
      'Labels',
      'Description',
      'Parent',
      'Team',
      'Size',
      'Signed Off',
      'Launch',
      'Severity',
    ]);
  });

  it('joins a custom field holding several values with commas', () => {
    const many = item(
      { title: 'Both', status: 'todo', 'f-team': ['Web', 'Mobile'] },
      { rank: 'c' },
    );
    const rows = boardCsvRows(setup, mapOf([many]), types);
    expect(rows[1]).toContain('Web, Mobile');
  });

  it('writes the cards the board shows, column by column in rank order', () => {
    const rows = boardCsvRows(setup, items, types);
    expect(rows.slice(1).map((r) => r[1])).toEqual(['Earlier', 'Ship it, "now"', 'Epic', 'Crash']);
    expect(rows[2]).toEqual([
      String(first.key),
      'Ship it, "now"',
      'Task',
      'To Do',
      'Sam Lee',
      'High',
      '2026-10-01',
      '2026-10-11',
      '5',
      'web, q3',
      'Line one\nline two',
      'Epic',
      'Web',
      '3',
      'Yes',
      '',
      '',
    ]);
  });

  it('names an unnamed column as the board does, and leaves fields a type lacks empty', () => {
    const rows = boardCsvRows(setup, items, types);
    const crashRow = rows.find((r) => r[1] === 'Crash')!;
    expect(crashRow[3]).toBe('Done');
    expect(crashRow[4]).toBe('');
    expect(crashRow[5]).toBe('Urgent');
    expect(crashRow.at(-1)).toBe('S1');
  });

  it('names each card’s state on an All Cards board', () => {
    const all: PlanBoardSetup = {
      ...setup,
      allCards: true,
      addTypes: undefined,
      columns: [{ id: 'c', status: 'all', name: 'All' }],
    };
    const rows = boardCsvRows(all, items, types, new Map([['doing', 'Doing Now']]));
    expect(rows.find((r) => r[1] === 'Epic')![3]).toBe('Doing Now');
    expect(rows.find((r) => r[1] === 'Not shown')![3]).toBe('Todo');
  });

  it('is only the header for an empty board', () => {
    expect(boardCsvRows(setup, new Map(), types)).toHaveLength(1);
  });
});

describe('cardDateOf', () => {
  it.each([
    ['2026-10-11', '2026-10-11'],
    ['2026-1-5', '2026-01-05'],
    ['2026/10/11', '2026-10-11'],
    ['2026-10-11T09:00:00Z', '2026-10-11'],
    ['11/10/2026', '2026-10-11'],
    ['1.2.2026', '2026-02-01'],
    ['31-12-26', '2026-12-31'],
  ])('reads %s', (text, want) => expect(cardDateOf(text)).toBe(want));

  it.each(['2026-02-30', '31/02/2026', '13/13/2026', 'next week', '', '2026'])(
    'leaves %j empty',
    (text) => expect(cardDateOf(text)).toBeUndefined(),
  );
});

describe('boardCsvImport', () => {
  const ctx: BoardCsvImportContext = { setup, types, people: [SAM, ALI], room: 100 };

  it('makes a card per row, mapping headers case-insensitively', () => {
    const { creates, skipped } = boardCsvImport(
      [
        [
          'TITLE',
          ' status ',
          'Card Type',
          'Owner',
          'priority',
          'Start Date',
          'Due',
          'Points',
          'Labels',
          'Description',
          'team',
          'Size',
          'Signed off',
          'Launch',
          'Mystery',
        ],
        [
          'Write docs',
          'in progress',
          'task',
          'sam lee',
          'High',
          '1/10/2026',
          '2026-10-11',
          '8',
          'a; b, a',
          'Body',
          'mobile',
          '2.5',
          'yes',
          '24/12/2026',
          '?',
        ],
      ],
      ctx,
    );
    expect(skipped).toBe(0);
    expect(creates).toEqual([
      {
        type: 'task',
        place: { status: 'doing' },
        fields: {
          title: 'Write docs',
          assignee: SAM,
          priority: 'high',
          start: '2026-10-01',
          due: '2026-10-11',
          estimate: 8,
          labels: ['a', 'b'],
          description: 'Body',
          'f-team': 'Mobile',
          'f-size': 2.5,
          'f-ok': true,
          'f-on': '2026-12-24',
        },
      },
    ]);
  });

  it('falls back to the board’s first type and column, and leaves what it cannot match empty', () => {
    const { creates } = boardCsvImport(
      [
        [
          'Title',
          'Type',
          'Status',
          'Assignee',
          'Priority',
          'Due',
          'Estimate',
          'Team',
          'Signed Off',
        ],
        ['A', 'Unknown', 'Nowhere', 'Nobody', 'Huge', '30/02/2026', '1000', 'Desktop', 'no'],
      ],
      ctx,
    );
    expect(creates[0]).toEqual({ type: 'task', place: { status: 'todo' }, fields: { title: 'A' } });
  });

  it('matches a type by label and moves it off a status it leaves out', () => {
    const { creates } = boardCsvImport(
      [
        ['Title', 'Type', 'Status', 'Severity', 'Assignee'],
        ['Crash', 'BUG', 'To Do', 'S2', 'Ali'],
      ],
      ctx,
    );
    // A Bug cannot be To Do: the first column it allows; it offers no Assignee, so none is set.
    expect(creates[0]).toEqual({
      type: 'bug',
      place: { status: 'doing' },
      fields: { title: 'Crash', 'f-sev': 'S2' },
    });
  });

  it('starts a card in its type’s Default State when no status is named', () => {
    const withDefault = [{ ...task, defaultStatus: 'doing' }, bug];
    const { creates } = boardCsvImport([['Title'], ['A']], { ...ctx, types: withDefault });
    expect(creates[0]!.place).toEqual({ status: 'doing' });
  });

  it('skips rows without a title and ignores blank lines and the Key column', () => {
    const r = boardCsvImport(
      [
        ['Key', 'Title'],
        ['7', ''],
        ['', ''],
        ['9', ' Kept '],
        ['3', '   '],
      ],
      ctx,
    );
    expect(r.creates.map((c) => c.fields['title'])).toEqual(['Kept']);
    expect(r.skipped).toBe(2);
  });

  it('cuts long values to their limits', () => {
    const long = 'x'.repeat(ITEM_TITLE_MAX + 20);
    const labels = Array.from({ length: ITEM_LABELS_MAX + 3 }, (_, i) => `l${i}`).join(',');
    const { creates } = boardCsvImport(
      [
        ['Title', 'Labels', 'Description'],
        [long, labels, 'd'.repeat(ITEM_DESCRIPTION_MAX + 5)],
      ],
      ctx,
    );
    const f = creates[0]!.fields;
    expect((f['title'] as string).length).toBe(ITEM_TITLE_MAX);
    expect((f['labels'] as string[]).length).toBe(ITEM_LABELS_MAX);
    expect((f['description'] as string).length).toBe(ITEM_DESCRIPTION_MAX);
  });

  it('adds no more than the document has room for', () => {
    const rows = [['Title'], ...Array.from({ length: 5 }, (_, i) => [`Card ${i}`])];
    const r = boardCsvImport(rows, { ...ctx, room: 3 });
    expect(r.creates).toHaveLength(3);
    expect(r.skipped).toBe(2);
  });

  it('refuses a file without a Title column, an Archive board and a board taking no types', () => {
    expect(boardCsvImport([['Name'], ['A']], ctx).refusal).toBe('no_title_column');
    expect(boardCsvImport([], ctx).refusal).toBe('no_title_column');
    expect(
      boardCsvImport([['Title'], ['A']], { ...ctx, setup: { ...setup, archive: true } }).refusal,
    ).toBe('archive');
    expect(
      boardCsvImport([['Title'], ['A']], { ...ctx, setup: { ...setup, addTypes: [] } }).refusal,
    ).toBe('no_types');
    expect(boardTakesCsv(setup)).toBe(true);
    expect(boardTakesCsv({ archive: true })).toBe(false);
  });

  it('skips a row whose type allows none of the board’s statuses', () => {
    const picky = [{ ...task, excludedStatuses: ['todo', 'doing', 'done'] }];
    const r = boardCsvImport([['Title'], ['A']], {
      ...ctx,
      types: picky,
      setup: { ...setup, addTypes: undefined },
    });
    expect(r).toEqual({ creates: [], skipped: 1 });
  });

  it('places cards by a state any board names on an All Cards board', () => {
    const all: PlanBoardSetup = {
      ...setup,
      allCards: true,
      columns: [{ id: 'c', status: 'all', name: 'All' }],
    };
    const r = boardCsvImport(
      [
        ['Title', 'State'],
        ['A', 'Review'],
      ],
      {
        ...ctx,
        setup: all,
        statusNames: new Map([
          ['todo', 'To Do'],
          ['review', 'Review'],
        ]),
      },
    );
    expect(r.creates[0]!.place).toEqual({ status: 'review' });
  });

  it('round-trips its own download', () => {
    const items = mapOf([
      item({ title: 'One', status: 'doing', priority: 'low', due: '2026-11-02', labels: ['x'] }),
    ]);
    const rows = boardCsvRows(setup, items, types);
    const { creates } = boardCsvImport(rows, ctx);
    expect(creates[0]).toEqual({
      type: 'task',
      place: { status: 'doing' },
      fields: { title: 'One', priority: 'low', due: '2026-11-02', labels: ['x'] },
    });
  });
});

describe('boardCsvMessage', () => {
  it.each([
    [{ added: 12, skipped: 0 }, 'Added 12 cards'],
    [{ added: 1, skipped: 1 }, 'Added 1 card; skipped 1 row'],
    [{ added: 2, skipped: 3 }, 'Added 2 cards; skipped 3 rows'],
    [{ added: 0, skipped: 2 }, 'No cards added; skipped 2 rows'],
    [{ added: 0, skipped: 0 }, 'No cards to add'],
    [{ added: 0, skipped: 0, refusal: 'no_title_column' as const }, 'No Title column in the file'],
    [{ added: 0, skipped: 0, refusal: 'no_types' as const }, 'This board takes no card types'],
    [
      { added: 0, skipped: 0, refusal: 'archive' as const },
      'Cards cannot be imported onto an Archive board',
    ],
  ])('%j says %s', (result, text) => expect(boardCsvMessage(result)).toBe(text));
});

describe('Multiple Choice and Rating fields', () => {
  const survey: ItemTypeDef = {
    ...note,
    id: 'survey',
    label: 'Survey',
    fields: ['title', 'status', 'f-diet', 'f-stars'],
    custom: [
      {
        id: 'f-diet',
        label: 'Diet',
        kind: 'multichoice',
        options: ['Vegan', 'Halal', 'Nuts, none'],
      },
      { id: 'f-stars', label: 'Stars', kind: 'rating', scale: 5 },
    ],
  };
  const surveySetup: PlanBoardSetup = { ...setup, addTypes: ['survey'] };

  it('writes a Multiple Choice’s picks apart by semicolons, and a Rating as its number', () => {
    const picked = item(
      { title: 'A', status: 'todo', 'f-diet': ['Vegan', 'Nuts, none'], 'f-stars': 4 },
      { type: 'survey' },
    );
    const lone = item({ title: 'B', status: 'todo', 'f-diet': 'Halal' }, { type: 'survey' });
    const rows = boardCsvRows(surveySetup, mapOf([picked, lone]), [survey]);
    expect(rows[0]!.slice(-2)).toEqual(['Diet', 'Stars']);
    expect(rows.find((r) => r[1] === 'A')!.slice(-2)).toEqual(['Vegan; Nuts, none', '4']);
    expect(rows.find((r) => r[1] === 'B')!.slice(-2)).toEqual(['Halal', '']);
  });

  it('reads them back, dropping picks that are not options and ratings off the scale', () => {
    const { creates } = boardCsvImport(
      [
        ['Title', 'Diet', 'Stars'],
        ['A', 'nuts, none; vegan', '5'],
        ['B', 'Salad', '6'],
        ['C', 'Vegan, Halal', '2.5'],
      ],
      { setup: surveySetup, types: [survey], people: [], room: 100 },
    );
    expect(creates.map((c) => [c.fields['f-diet'], c.fields['f-stars']])).toEqual([
      [['Vegan', 'Nuts, none'], 5],
      [undefined, undefined],
      [['Vegan', 'Halal'], undefined],
    ]);
  });

  it('splits on commas only when every part is an option', () => {
    const options = ['Vegan', 'Halal', 'Nuts, none'];
    expect(multiChoiceOf(options, 'Halal, Vegan')).toEqual(['Vegan', 'Halal']);
    expect(multiChoiceOf(options, 'Nuts, none')).toEqual(['Nuts, none']);
    expect(multiChoiceOf(options, 'Vegan, Salad')).toBeUndefined();
    expect(multiChoiceOf(options, '')).toBeUndefined();
  });
});
