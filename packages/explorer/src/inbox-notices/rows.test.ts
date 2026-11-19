// Which rows notify (rows.ts, inbox-notices.md "What notifies"): each kind and what it says, the reader's own moves
// never, the 24 hour cut, what was there when this browser first watched, and a card thread read through two plans.
import { describe, expect, it } from 'vitest';
import type {
  InboxAccessRequest,
  InboxAction,
  InboxResponse,
  InboxShare,
  InboxThread,
} from '@liveworkspace/index-client';
import { siteOfApp } from '@liveworkspace/sites';
import {
  NOTICE_MAX_AGE_MS,
  freshRows,
  inboxRowHref,
  itemHref,
  noticeHeadline,
  noticeRows,
} from './rows';

const ME = 'user_me';
const NOW = 10_000_000;

const thread = (over: Partial<InboxThread> = {}): InboxThread => ({
  app: 'livediagram',
  itemId: 'd1',
  itemTitle: 'Roadmap',
  itemTeamId: null,
  tabId: 't1',
  tabName: 'Q3',
  elementId: 'e1',
  elementLabel: 'Box',
  card: null,
  resolved: false,
  commentCount: 2,
  latestText: 'Can you check the totals?\nThanks',
  latestAuthorName: 'Priya',
  latestAuthorColor: '#f00',
  latestAuthorId: 'user_p',
  mentionsYou: false,
  mentionedBy: null,
  youCommented: false,
  onYourItem: true,
  firstAt: NOW - 1000,
  latestAt: NOW - 500,
  ...over,
});

const action = (over: Partial<InboxAction> = {}): InboxAction => ({
  app: 'liveplanner',
  itemId: 'p1',
  itemTitle: 'Sprint',
  itemTeamId: null,
  tabId: '~cards',
  tabName: '',
  elementId: 'c1',
  actionId: 'c1',
  elementLabel: 'Card',
  name: 'Fix login',
  description: '',
  status: 'open',
  assigneeId: ME,
  assigneeName: 'Me',
  assignerId: 'user_b',
  assignerName: 'Bo',
  teamId: null,
  card: {
    key: 12,
    type: 'task',
    typeLabel: 'Task',
    title: 'Fix login',
    board: { tabId: 'b', name: 'Board' },
  } as InboxAction['card'],
  createdAt: NOW - 900,
  updatedAt: NOW - 400,
  ...over,
});

const request = (over: Partial<InboxAccessRequest> = {}): InboxAccessRequest => ({
  id: 'ar1',
  app: 'livedocuments',
  itemId: 'doc1',
  itemTitle: 'Budget',
  itemTeamId: null,
  requesterId: 'user_a',
  requesterName: 'Ana',
  note: 'For the review',
  askedAt: NOW - 300,
  ...over,
});

const share = (over: Partial<InboxShare> = {}): InboxShare => ({
  id: 'ar2',
  app: 'livedesign',
  itemId: 'des1',
  itemTitle: 'Poster',
  itemTeamId: null,
  sharedById: 'user_a',
  sharedByName: 'Ana',
  sharedAt: NOW - 200,
  ...over,
});

const inbox = (over: Partial<InboxResponse> = {}): InboxResponse => ({
  threads: [],
  actions: [],
  forms: [],
  ...over,
});

describe('each kind', () => {
  it('a mention says who mentioned the reader, with the first line', () => {
    const [row] = noticeRows(
      inbox({
        threads: [thread({ mentionsYou: true, mentionedBy: { id: 'user_q', name: 'Quinn' } })],
      }),
      ME,
      'livediagram',
    );
    expect(row).toMatchObject({
      kind: 'mention',
      who: 'Quinn',
      verb: 'mentioned you',
      quote: 'Can you check the totals?',
      place: 'Roadmap',
      detail: 'Q3',
      href: '/explorer/inbox?at=t%3Alivediagram%3Ad1%3At1%3Ae1',
    });
    expect(noticeHeadline(row!)).toBe('Quinn mentioned you');
  });

  it('a mention by the reader themselves names the latest author', () => {
    const [row] = noticeRows(
      inbox({ threads: [thread({ mentionsYou: true, mentionedBy: { id: ME, name: 'Me' } })] }),
      ME,
      'livediagram',
    );
    expect(row!.who).toBe('Priya');
  });

  it('a comment on the reader’s item, and a reply in a thread they are in', () => {
    const rows = noticeRows(
      inbox({
        threads: [
          thread(),
          thread({ elementId: 'e2', onYourItem: false, youCommented: true, latestAt: NOW - 100 }),
        ],
      }),
      ME,
      'livediagram',
    );
    expect(rows.map((r) => [r.kind, r.verb])).toEqual([
      ['comment', 'replied'],
      ['comment', 'commented'],
    ]);
  });

  it('a card or action handed to the reader', () => {
    const rows = noticeRows(
      inbox({
        actions: [
          action(),
          action({ actionId: 'a2', card: null, name: 'Review', updatedAt: NOW - 450 }),
        ],
      }),
      ME,
      'liveplanner',
    );
    expect(rows.map((r) => [noticeHeadline(r), r.detail, r.href])).toEqual([
      ['Bo assigned you a card', '#12 Fix login', '/explorer/inbox?at=a%3Aliveplanner%3Ap1%3Ac1'],
      ['Bo assigned you an action', 'Review', '/explorer/inbox?at=a%3Aliveplanner%3Ap1%3Aa2'],
    ]);
  });

  it('an access request and a share open the item, on its own app’s address', () => {
    const rows = noticeRows(
      inbox({ accessRequests: [request()], shares: [share()] }),
      ME,
      'livediagram',
    );
    expect(rows.map((r) => [r.kind, noticeHeadline(r), r.quote, r.href])).toEqual([
      ['share', 'Ana shared it with you', null, `${siteOfApp('livedesign').url}/design/des1`],
      [
        'access',
        'Ana asked for access',
        'For the review',
        `${siteOfApp('livedocuments').url}/document/doc1`,
      ],
    ]);
  });

  it('says Someone when a row names no one, and a card thread names its card', () => {
    const rows = noticeRows(
      inbox({
        threads: [
          thread({
            latestAuthorName: '',
            card: { id: 'k1', key: 4, title: 'Login', type: 't', typeLabel: 'Task' } as never,
            latestText: '   ',
          }),
        ],
        accessRequests: [request({ requesterName: null, note: null })],
        shares: [share({ sharedByName: null })],
        actions: [action({ assignerName: null })],
      }),
      ME,
      'livediagram',
    );
    expect(rows.map((r) => r.who)).toEqual(['Someone', 'Someone', 'Someone', 'Someone']);
    expect(rows.find((r) => r.kind === 'comment')).toMatchObject({
      detail: '#4 Login',
      quote: null,
    });
  });

  it('cuts a long first line', () => {
    const [row] = noticeRows(
      inbox({ threads: [thread({ latestText: 'x'.repeat(300) })] }),
      ME,
      'livediagram',
    );
    expect(row!.quote!.length).toBe(120);
    expect(row!.quote!.endsWith('…')).toBe(true);
  });

  it('links another app’s row to the Inbox on that app’s address', () => {
    expect(inboxRowHref('liveplanner', 'a:x', 'livediagram')).toBe(
      `${siteOfApp('liveplanner').url}/explorer/inbox?at=a%3Ax`,
    );
    expect(itemHref('livediagram', 'd 1', 'livediagram')).toBe('/document/d%201');
  });
});

describe('never the reader’s own moves', () => {
  it('leaves out their own latest comment, work they handed out, a self-assignment and agents', () => {
    const rows = noticeRows(
      inbox({
        threads: [
          thread({ latestAuthorId: ME }),
          thread({ elementId: 'x', latestAuthorId: null }),
          thread({ elementId: 'y', resolved: true }),
          // Reached only through their agent.
          thread({ elementId: 'z', onYourItem: false, youCommented: false }),
          thread({ elementId: 'm', mentionsYou: true, latestAuthorId: ME }),
        ],
        actions: [
          action({ assigneeId: 'user_b', assignerId: ME }),
          action({ actionId: 's', assignerId: ME }),
          action({ actionId: 'd', status: 'done' }),
        ],
        accessRequests: [request({ requesterId: ME })],
        shares: [share({ sharedById: ME })],
      }),
      ME,
      'livediagram',
    );
    expect(rows).toEqual([]);
  });

  it('reads nothing from no Inbox', () => {
    expect(noticeRows(null, ME, 'livediagram')).toEqual([]);
  });
});

describe('a card thread read through two plans', () => {
  it('is one row, the newer', () => {
    const card = { id: 'k1', key: 4, title: 'Login', type: 't', typeLabel: 'Task' } as never;
    const rows = noticeRows(
      inbox({
        threads: [
          thread({ app: 'liveplanner', itemId: 'p1', card, latestAt: NOW - 700 }),
          thread({ app: 'liveplanner', itemId: 'p2', card, latestAt: NOW - 100 }),
          thread({ app: 'liveplanner', itemId: 'p3', card, latestAt: NOW - 900 }),
        ],
      }),
      ME,
      'liveplanner',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.at).toBe(NOW - 100);
  });
});

describe('what is news here', () => {
  const seen = (since: number, marks: Record<string, number> = {}) => ({
    since: () => since,
    has: (r: { key: string; at: number }) => (marks[r.key] ?? -Infinity) >= r.at,
  });
  const rows = noticeRows(
    inbox({ threads: [thread()], actions: [action()], accessRequests: [request()] }),
    ME,
    'livediagram',
  );

  it('after this browser first watched, and not seen at that time', () => {
    expect(freshRows(rows, seen(NOW - 450), NOW).map((r) => r.kind)).toEqual([
      'access',
      'assigned',
    ]);
    expect(freshRows(rows, seen(0, { 'r:ar1': NOW - 300 }), NOW)).toHaveLength(2);
    // A row that changed after it was seen is news again.
    expect(freshRows(rows, seen(0, { 'r:ar1': NOW - 301 }), NOW)).toHaveLength(3);
  });

  it('never a row more than a day old', () => {
    expect(freshRows(rows, seen(0), NOW + NOTICE_MAX_AGE_MS - 350)).toHaveLength(1);
  });
});
