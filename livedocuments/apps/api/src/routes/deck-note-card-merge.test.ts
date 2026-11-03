import { describe, expect, it } from 'vitest';
import {
  parseStoredPresentation,
  type NoteCard,
  type StoredPresentation,
} from '@livedocuments/document';
import { sqliteD1 } from '../test-sqlite-d1';
import type { DocumentGrant } from '../index-service';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// docs/specs/012-collaboration/speaker-note-cards.md "Two people writing at once": two editors write different note
// cards on one slide at once, each saving the whole deck over what it loaded, and both cards survive.

const deckOf = (cards: NoteCard[]): string =>
  JSON.stringify({
    decks: [{ slides: [{ id: 's1', tabId: 't1', elementIds: [], noteCards: cards }] }],
  } satisfies StoredPresentation);
const loaded = deckOf([
  { id: 'c1', text: 'Open with the story' },
  { id: 'c2', text: 'The numbers' },
]);

const grant = (sub: string, level: DocumentGrant['level']): DocumentGrant => ({
  item: 'd1',
  level,
  tab: null,
  sub,
  team: null,
  exp: Math.floor(Date.now() / 1000) + 600,
  shareCode: 'code',
  token: `test-grant:d1:${sub}`,
});

async function setUp() {
  const db = sqliteD1();
  const created = await handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      owner: 'alex',
      body: { id: 'd1', name: 'Pitch', tabs: [{ id: 't1', name: 'Slides', elements: [] }] },
    }),
  );
  expect(created.status).toBe(201);
  const first = await put(db.env, 'alex', { presentation: loaded });
  expect(first.status).toBe(200);
  return db;
}

const put = (
  env: ReturnType<typeof sqliteD1>['env'],
  who: string,
  body: Record<string, unknown>,
  level: DocumentGrant['level'] = 'edit',
) =>
  handleDocuments(
    makeTestRouteContext('PUT', '/api/documents/d1', {
      env,
      owner: who,
      body,
      ...(who === 'alex' ? {} : { grant: grant(who, level) }),
    }),
  );

function storedCards(db: ReturnType<typeof sqliteD1>): readonly NoteCard[] {
  const row = db.sql.prepare('SELECT presentation FROM document WHERE id = ?').get('d1') as {
    presentation: string | null;
  };
  return parseStoredPresentation(row.presentation)?.decks[0]?.slides[0]?.noteCards ?? [];
}

describe('two editors writing note cards on one slide at once', () => {
  it('keeps both edits and both new cards, each client saving over the deck it loaded', async () => {
    const db = await setUp();
    // Alex rewrites card 1 and adds a card; Sam, from the same loaded deck, rewrites card 2 and adds one.
    const alex = deckOf([
      { id: 'c1', text: 'Open with the customer story' },
      { id: 'c2', text: 'The numbers' },
      { id: 'c3_alex', text: 'Ask for the pilot' },
    ]);
    const sam = deckOf([
      { id: 'c1', text: 'Open with the story' },
      { id: 'c2', text: 'The numbers: 92% satisfied' },
      { id: 'c3_samm', text: 'Thank the team' },
    ]);
    expect(
      (await put(db.env, 'alex', { presentation: alex, presentationBase: loaded })).status,
    ).toBe(200);
    expect((await put(db.env, 'sam', { presentation: sam, presentationBase: loaded })).status).toBe(
      200,
    );
    expect(storedCards(db)).toEqual([
      { id: 'c1', text: 'Open with the customer story' },
      { id: 'c2', text: 'The numbers: 92% satisfied' },
      { id: 'c3_alex', text: 'Ask for the pilot' },
      { id: 'c3_samm', text: 'Thank the team' },
    ]);

    // Alex types on in card 1, saving over what Alex last sent: Sam's work stays.
    const alexAgain = deckOf([
      { id: 'c1', text: 'Open with the customer story, briefly' },
      { id: 'c2', text: 'The numbers' },
      { id: 'c3_alex', text: 'Ask for the pilot' },
    ]);
    await put(db.env, 'alex', { presentation: alexAgain, presentationBase: alex });
    expect(storedCards(db).map((c) => c.text)).toEqual([
      'Open with the customer story, briefly',
      'The numbers: 92% satisfied',
      'Ask for the pilot',
      'Thank the team',
    ]);
  });

  it('writes a deck sent without a base as sent, as an older editor or a script does', async () => {
    const db = await setUp();
    await put(db.env, 'sam', { presentation: deckOf([{ id: 'c9', text: 'Only this' }]) });
    expect(storedCards(db)).toEqual([{ id: 'c9', text: 'Only this' }]);
  });

  it('builds on no deck when the base is null, keeping the cards stored since', async () => {
    const db = await setUp();
    const mine = deckOf([{ id: 'c5_mine', text: 'Mine' }]);
    await put(db.env, 'sam', { presentation: mine, presentationBase: null });
    expect(storedCards(db).map((c) => c.id)).toEqual(['c1', 'c2', 'c5_mine']);
  });

  it('clears the deck when null is sent, base or not', async () => {
    const db = await setUp();
    await put(db.env, 'sam', { presentation: null, presentationBase: loaded });
    expect(storedCards(db)).toEqual([]);
  });

  it('writes the deck as sent when its base does not parse', async () => {
    const db = await setUp();
    const mine = deckOf([{ id: 'c1', text: 'Mine' }]);
    await put(db.env, 'sam', { presentation: mine, presentationBase: 'not a deck' });
    expect(storedCards(db)).toEqual([{ id: 'c1', text: 'Mine' }]);
    // A deck that does not parse has no cards to merge: stored as sent, as before.
    await put(db.env, 'sam', { presentation: 'not a deck', presentationBase: mine });
    const row = db.sql.prepare('SELECT presentation FROM document WHERE id = ?').get('d1');
    expect(row).toEqual({ presentation: 'not a deck' });
  });

  it('refuses a base that is not a string or is past the deck cap', async () => {
    const db = await setUp();
    expect((await put(db.env, 'sam', { presentation: loaded, presentationBase: 7 })).status).toBe(
      400,
    );
    const huge = 'x'.repeat(256 * 1024 + 1);
    expect(
      (await put(db.env, 'sam', { presentation: loaded, presentationBase: huge })).status,
    ).toBe(400);
  });

  it('lets a Participant or a Viewer write no cards', async () => {
    for (const level of ['participate', 'view'] as const) {
      const db = await setUp();
      const res = await put(
        db.env,
        'pat',
        {
          presentation: deckOf([{ id: 'c1', text: 'Not mine to write' }]),
          presentationBase: loaded,
        },
        level,
      );
      expect(res.status).toBe(403);
      expect(storedCards(db).map((c) => c.id)).toEqual(['c1', 'c2']);
    }
  });
});
