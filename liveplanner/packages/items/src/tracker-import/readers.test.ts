import { describe, expect, it } from 'vitest';
import asanaCsv from './fixtures/asana-project.csv?raw';
import jiraCsv from './fixtures/jira-issues.csv?raw';
import linearCsv from './fixtures/linear-issues.csv?raw';
import trelloJson from './fixtures/trello-board.json?raw';
import { ASANA_COMPLETED_COLUMN, readAsanaRows } from './asana';
import { readJiraRows } from './jira';
import { readLinearRows } from './linear';
import {
  TRACKER_UNTITLED,
  isTrackerRefusal,
  readTrackerFile,
  trackerRefusalMessage,
} from './read-tracker-file';
import { csvRows } from './test-csv';
import type { TrackerBoard, TrackerCard } from './tracker-model';
import { readTrelloBoard } from './trello';

// docs/specs/026-plan/tracker-import.md "Fields": each reader against a realistic export of its tool.

const read = (text: string, name?: string): TrackerBoard => {
  const board = readTrackerFile(text, csvRows, name);
  if (isTrackerRefusal(board)) throw new Error(board.refusal);
  return board;
};
const card = (board: TrackerBoard, title: string): TrackerCard =>
  board.cards.find((c) => c.title === title)!;

describe('the test CSV splitter', () => {
  it('splits quoted cells, doubled quotes and a last row with no line break', () => {
    expect(csvRows('a,"b ""c""\nd"\r\ne,f')).toEqual([
      ['a', 'b "c"\nd'],
      ['e', 'f'],
    ]);
    expect(csvRows('a\n')).toEqual([['a']]);
  });
});

describe('Trello', () => {
  const board = read(trelloJson);

  it('reads the open lists in their order as columns, skipping archived lists and cards', () => {
    expect(board.source).toBe('trello');
    expect(board.title).toBe('Website Relaunch');
    expect(board.columns).toEqual(['Backlog', 'Doing', 'In Review', 'Done']);
    expect(board.cards.map((c) => c.title)).toEqual([
      'Rewrite pricing copy',
      'Login button does nothing on Safari',
      'Design the new hero section',
      'Footer links',
      'Announce the launch',
    ]);
    expect(board.skips).toMatchObject({ archivedLists: 1, archivedCards: 2 });
  });

  it('keeps every field of a full card, its text as text', () => {
    const hero = card(board, 'Design the new hero section');
    expect(hero.column).toBe('Doing');
    expect(hero.description).toContain("<script>alert('x')</script>");
    expect(hero.labels).toEqual(['Design']);
    expect(hero.priority).toBe('high');
    expect(hero.assignee).toEqual({ name: 'Ana Lopez' });
    expect(hero.extras['members']).toEqual([{ name: 'Ana Lopez' }, { name: 'Ben Okafor' }]);
    expect(hero.due).toBe('2026-11-14');
    expect(hero.start).toBe('2026-11-03');
    expect(hero.checklist).toEqual([
      { text: 'QA: Test on Chrome', done: true },
      { text: 'QA: Test on Safari', done: false },
      { text: 'Copy: Headline signed off', done: false },
    ]);
    expect(hero.comments.map((c) => [c.author, c.text])).toEqual([
      ['Ben Okafor', 'First draft is in Figma.'],
      ['Ana Lopez', 'Looks great. @benokafor can you check mobile?'],
    ]);
    expect(hero.comments[0]!.at).toBe(Date.parse('2026-10-27T09:05:00.000Z'));
    expect(hero.links).toEqual([
      {
        name: 'hero-v2.png',
        url: 'https://trello.com/1/cards/card-hero/attachments/att-1/download/hero-v2.png',
      },
    ]);
    expect(board.skips).toMatchObject({ attachmentLinks: 1, attachmentsNoLink: 1 });
  });

  it('drops control characters, names a colour label by its colour and a member by username', () => {
    const login = card(board, 'Login button does nothing on Safari');
    expect(login.labels).toEqual(['Bug', 'purple']);
    expect(login.assignee).toEqual({ name: 'chenwei' });
    expect(login.comments[0]!.author).toBe('chenwei');
    expect(login.extras['members']).toEqual([{ name: 'chenwei' }]);
  });

  it('names checklist items plainly on a card of one checklist', () => {
    expect(card(board, 'Footer links').checklist).toEqual([
      { text: 'Privacy link', done: true },
      { text: 'Cookie link', done: false },
    ]);
  });

  it('makes Members a field only when some card has more than one member', () => {
    expect(board.extras).toEqual([
      { key: 'members', label: 'Members', kind: 'person', several: true },
    ]);
    const single = readTrelloBoard({
      name: 'Solo',
      lists: [{ id: 'l', name: 'To Do' }],
      members: [{ id: 'm', fullName: 'Ana' }],
      cards: [{ id: 'c', name: 'One', idList: 'l', idMembers: ['m'] }],
    });
    expect(single.extras).toEqual([]);
    expect(single.cards[0]!.extras).toEqual({});
  });

  it('reads a board with missing or wrong-typed parts as empty, never throwing', () => {
    const odd = readTrelloBoard({
      lists: [{ id: 'a', name: 'A', pos: 'x' }, 'not a list'],
      cards: [
        { id: 'c1', idList: 'a', labels: 'x', idLabels: ['nope'], attachments: [{ url: 7 }] },
        { id: 'c2', idList: 'a', idLabels: ['l1'] },
        { id: 'c3', idList: 'a', name: 'Card with orphan checklist' },
      ],
      labels: [{ id: 'l1', name: 'Low', color: 'blue' }],
      checklists: [
        { id: 'k', idCard: 'c3', checkItems: [{ name: 'Row', state: 'complete' }, { name: '' }] },
        { idCard: '' },
      ],
      actions: [
        { type: 'commentCard', data: { text: 'No card' } },
        { type: 'commentCard', data: 'x' },
        { type: 'commentCard', date: 'nope', data: { text: 'Hi', card: { id: 'c1' } } },
        { type: 'commentCard', date: 'nope', data: { text: 'Again', card: { id: 'c1' } } },
      ],
    });
    expect(odd.title).toBe('');
    expect(odd.cards.map((c) => c.title)).toEqual([
      'Untitled',
      'Untitled',
      'Card with orphan checklist',
    ]);
    expect(odd.cards[0]!.labels).toEqual([]);
    expect(odd.cards[0]!.comments).toEqual([
      { author: '', at: null, text: 'Hi' },
      { author: '', at: null, text: 'Again' },
    ]);
    expect(odd.cards[1]!.priority).toBe('low');
    expect(odd.cards[2]!.checklist).toEqual([{ text: 'Row', done: true }]);
    expect(odd.skips).toEqual({ attachmentsNoLink: 1 });
  });
});

describe('Asana', () => {
  const board = read(asanaCsv, 'Marketing Calendar.csv');

  it('reads sections in row order, completed tasks in a Completed column after them', () => {
    expect(board.source).toBe('asana');
    expect(board.title).toBe('Marketing Calendar');
    expect(board.columns).toEqual(['To Do', 'In Progress', 'Review', '', ASANA_COMPLETED_COLUMN]);
    expect(card(board, 'Order swag').column).toBe(ASANA_COMPLETED_COLUMN);
    expect(board.skips).toEqual({ untitledRows: 1 });
  });

  it('keeps names, emails, tags, notes, dates, priority and projects', () => {
    const plan = card(board, 'Plan the Q4 campaign');
    expect(plan.assignee).toEqual({ name: 'Ana Lopez', email: 'ana@example.com' });
    expect(plan.labels).toEqual(['Marketing', 'Q4']);
    expect(plan.description).toBe('Draft the brief.\nShare with sales first.');
    expect(plan).toMatchObject({ start: '2026-11-02', due: '2026-11-21', priority: 'high' });
    expect(plan.extras['projects']).toBe('Marketing Calendar');
    expect(card(board, 'Book venue for launch').assignee).toEqual({
      name: 'Ben Okafor',
      email: 'ben@example.com',
    });
    const press = card(board, 'Write the press release');
    expect(press.labels).toEqual(['PR', 'Marketing']);
    expect(press.due).toBe('2026-12-31');
    expect(press.priority).toBe('low');
    expect(board.extras).toEqual([{ key: 'projects', label: 'Projects', kind: 'text' }]);
  });

  it('keeps a formula as plain text and reads an email in the name cell as the person', () => {
    expect(card(board, 'Order swag').description).toBe('=HYPERLINK("http://evil.example","click")');
    const pick = card(board, 'Pick photographer');
    expect(pick.assignee).toEqual({ name: 'carla', email: 'carla@example.com' });
    expect(pick.due).toBeUndefined();
    expect(pick.priority).toBeUndefined();
  });

  it('adds no Completed column when nothing is completed, and reads a header with no rows', () => {
    const open = readAsanaRows([
      ['Task ID', 'Name', 'Section/Column'],
      ['1', 'A', 'Now'],
    ]);
    expect(open.columns).toEqual(['Now']);
    expect(open.extras).toEqual([]);
    expect(readAsanaRows([['Task ID', 'Section/Column', 'Name', 'Completed At']]).cards).toEqual(
      [],
    );
    const done = readAsanaRows([
      ['Task ID', 'Name', 'Section/Column', 'Completed At'],
      ['1', 'A', 'Completed', '2026-01-01'],
    ]);
    expect(done.columns).toEqual(['Completed']);
  });
});

describe('Jira', () => {
  const board = read(jiraCsv, 'Jira.csv');

  it('reads statuses as columns in row order and every repeated column', () => {
    expect(board.source).toBe('jira');
    expect(board.title).toBe('Jira');
    expect(board.columns).toEqual(['In Progress', 'To Do', 'Done', '']);
    expect(board.skips).toMatchObject({
      untitledRows: 1,
      attachmentLinks: 1,
      attachmentsNoLink: 1,
    });
    const bug = card(board, 'Checkout fails for EU cards');
    expect(bug.labels).toEqual(['payments', 'eu']);
    expect(bug).toMatchObject({
      priority: 'urgent',
      estimate: 5,
      start: '2025-03-13',
      due: '2025-03-20',
    });
    expect(bug.assignee).toEqual({ name: 'Ana Lopez' });
    expect(bug.description).toBe('Steps:\n1. Add an item\n2. Pay with a German card');
    expect(bug.extras).toEqual({
      issuekey: 'SHOP-101',
      issuetype: 'Bug',
      reporter: [{ name: 'Ben Okafor' }],
      sprint: 'Sprint 8',
      components: 'Checkout, API',
    });
    expect(bug.links).toEqual([
      { name: 'trace.log', url: 'https://shop.atlassian.net/secure/attachment/1/trace.log' },
    ]);
  });

  it('names comment authors through the file, keeps semicolons in text, sorts oldest first', () => {
    const bug = card(board, 'Checkout fails for EU cards');
    expect(bug.comments).toEqual([
      { author: 'Ana Lopez', at: Date.UTC(2025, 2, 12, 10, 15), text: 'Looking into it now.' },
      {
        author: 'Ben Okafor',
        at: Date.UTC(2025, 2, 13, 15, 45),
        text: 'Still failing; see the attached log.',
      },
      { author: 'Jira user', at: Date.UTC(2025, 2, 14, 9, 0), text: 'Fixed in staging.' },
    ]);
    expect(card(board, 'Add Apple Pay').comments).toEqual([
      { author: '', at: null, text: 'Plain note with no date' },
    ]);
  });

  it('reads the issue type as a Choice, an unreadable estimate as none', () => {
    expect(board.extras.map((e) => e.key)).toEqual([
      'issuekey',
      'issuetype',
      'reporter',
      'sprint',
      'components',
    ]);
    expect(board.extras[1]).toMatchObject({ kind: 'choice', options: ['Bug', 'Story', 'Task'] });
    const photos = card(board, 'Refresh product photos');
    expect(photos.estimate).toBeUndefined();
    expect(photos.priority).toBe('low');
    expect(card(board, 'Clean up old coupons').column).toBe('');
  });

  it('names an author that is not an account id as written, and skips an empty comment', () => {
    const rows = [
      ['Summary', 'Issue key', 'Comment', 'Comment', 'Comment'],
      ['A', 'K-1', '01/Jan/26 9:00 am;Sam Lee;Hi', '01/Jan/26 10:00;Sam Lee;   ', 'x;y;z'],
    ];
    expect(readJiraRows(rows).cards[0]!.comments).toEqual([
      { author: '', at: null, text: 'x;y;z' },
      { author: 'Sam Lee', at: Date.UTC(2026, 0, 1, 9, 0), text: 'Hi' },
    ]);
  });

  it('turns a Choice of more values than a field holds into Text', () => {
    const rows = [
      ['Summary', 'Issue key', 'Issue Type'],
      ...Array.from({ length: 21 }, (_, i) => [`Card ${i}`, `K-${i}`, `Type ${i}`]),
    ];
    expect(readJiraRows(rows).extras.find((e) => e.key === 'issuetype')).toEqual({
      key: 'issuetype',
      label: 'Issue Type',
      kind: 'text',
    });
  });
});

describe('Linear', () => {
  const board = read(linearCsv);

  it('reads statuses in row order, skipping archived and untitled issues', () => {
    expect(board.source).toBe('linear');
    expect(board.title).toBe(TRACKER_UNTITLED);
    expect(board.columns).toEqual(['In Progress', 'Todo', 'Backlog']);
    expect(board.skips).toEqual({ archivedCards: 1, untitledRows: 1 });
  });

  it('keeps every field and the ID, project, cycle and team', () => {
    const ship = card(board, 'Ship the onboarding checklist');
    expect(ship).toMatchObject({
      priority: 'urgent',
      estimate: 3,
      start: '2026-10-21',
      due: '2026-11-07',
      labels: ['Frontend', 'Growth'],
    });
    expect(ship.assignee).toEqual({ name: 'ana', email: 'ana@example.com' });
    expect(ship.description).toContain('https://linear.app/acme/spec/onboarding');
    expect(ship.extras).toEqual({
      id: 'ENG-42',
      project: 'Onboarding',
      cycle: 'Cycle 12',
      team: 'Engineering',
    });
    expect(card(board, 'Fix flaky login test').extras['cycle']).toBe('12');
    const log = card(board, 'Write the API changelog');
    expect(log.estimate).toBeUndefined();
    expect(log.priority).toBeUndefined();
    expect(board.extras.map((e) => e.key)).toEqual(['id', 'project', 'cycle', 'team']);
  });

  it('reads a file with only the needed columns', () => {
    const b = readLinearRows([
      ['ID', 'Title', 'Status', 'Team'],
      ['X-1', 'One', 'Todo', ''],
    ]);
    expect(b.cards[0]!.labels).toEqual([]);
    expect(b.extras.map((e) => e.key)).toEqual(['id']);
  });
});

describe('readTrackerFile', () => {
  it('names the source from the file, refusing what it cannot read', () => {
    const refusal = (text: string) => readTrackerFile(text, csvRows);
    expect(refusal('{ nope')).toEqual({ refusal: 'not_json' });
    expect(refusal('{"cards": []}')).toEqual({ refusal: 'unknown_source' });
    expect(refusal('Name,Due\nA,B')).toEqual({ refusal: 'unknown_source' });
    expect(refusal('')).toEqual({ refusal: 'unknown_source' });
    expect(refusal('{"lists": [], "cards": []}')).toEqual({ refusal: 'no_cards' });
    const many = [
      'ID,Title,Status,Team',
      ...Array.from({ length: 2001 }, (_, i) => `X-${i},T${i},Todo,E`),
    ];
    expect(refusal(many.join('\n'))).toEqual({ refusal: 'too_many_cards', count: 2001 });
  });

  it('says each refusal in the words of the spec', () => {
    expect(trackerRefusalMessage({ refusal: 'not_json' })).toBe("That file isn't valid JSON.");
    expect(trackerRefusalMessage({ refusal: 'unknown_source' })).toBe(
      "This file isn't a Trello, Asana, Jira or Linear export.",
    );
    expect(trackerRefusalMessage({ refusal: 'no_cards' })).toBe(
      'That file has no cards to import.',
    );
    expect(trackerRefusalMessage({ refusal: 'too_many_cards', count: 2500 })).toBe(
      'That file has 2,500 cards. A plan holds up to 2,000.',
    );
    expect(trackerRefusalMessage({ refusal: 'too_many_cards' })).toBe(
      'That file has 0 cards. A plan holds up to 2,000.',
    );
  });

  it('titles a board from its file name when the file has none', () => {
    expect(read(linearCsv, 'Q4 issues.export.csv').title).toBe('Q4 issues.export');
    expect(read(linearCsv, '.csv').title).toBe(TRACKER_UNTITLED);
  });
});
