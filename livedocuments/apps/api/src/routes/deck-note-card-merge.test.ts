import { describe, expect, it } from 'vitest';
import {
  parseStoredPresentation,
  withNoteCards,
  type NoteCard,
  type StoredPresentation,
} from '@livedocuments/document';
import { MAX_BODY_BYTES, MAX_DECK_BASE_LEN, MAX_DECK_LEN } from '../limits';
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

  it('refuses a deck or base that is not a string, a deck past the cap and a base past its own cap', async () => {
    const db = await setUp();
    expect((await put(db.env, 'sam', { presentation: loaded, presentationBase: 7 })).status).toBe(
      400,
    );
    expect((await put(db.env, 'sam', { presentation: 7 })).status).toBe(400);
    expect((await put(db.env, 'sam', { presentation: 'x'.repeat(MAX_DECK_LEN + 1) })).status).toBe(
      413,
    );
    const huge = 'x'.repeat(MAX_DECK_BASE_LEN + 1);
    expect(
      (await put(db.env, 'sam', { presentation: loaded, presentationBase: huge })).status,
    ).toBe(413);
    expect(storedCards(db).map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  // The deck with these cards and a padding card that brings it to `length` (the cap by default), or one under when
  // the length cannot be met exactly. Written as the editor writes it, with the `notes` mirror (withNoteCards), so
  // the padding counts twice.
  const sized = (cards: NoteCard[], length = MAX_DECK_LEN): string => {
    const mirrored = (pad: number) =>
      JSON.stringify({
        decks: [
          {
            slides: [
              withNoteCards({ id: 's1', tabId: 't1', elementIds: [] }, [
                ...cards,
                { id: 'pad', text: 'x'.repeat(pad) },
              ]),
            ],
          },
        ],
      } satisfies StoredPresentation);
    const one = mirrored(1).length;
    const deck = mirrored(1 + Math.floor((length - one) / 2));
    expect(deck.length).toBeLessThanOrEqual(length);
    expect(deck.length).toBeGreaterThanOrEqual(length - 1);
    return deck;
  };

  // Work Tracker #389: every save carries its base, so a save is up to twice the deck. Each is held to its cap on its
  // own (speaker-note-cards.md "Saving"), so a deck at the cap still saves with its base, and is merged.
  it('saves and merges a deck at the cap sent with a base at the cap', async () => {
    const db = await setUp();
    const base = sized([{ id: 'c1', text: 'Open with the story' }]);
    expect((await put(db.env, 'alex', { presentation: base })).status).toBe(200);
    // Sam rewrites card 1 at the same length.
    const sam = sized([{ id: 'c1', text: 'Open with the stats' }]);
    expect((await put(db.env, 'sam', { presentation: sam, presentationBase: base })).status).toBe(
      200,
    );
    // Alex, on the same base, writes the padding card a character shorter: the merge keeps Sam's card 1.
    const alex = sized([{ id: 'c1', text: 'Open with the story' }], MAX_DECK_LEN - 2);
    const body = { presentation: alex, presentationBase: base };
    // About twice the deck, far under the body cap.
    expect(JSON.stringify(body).length).toBeLessThan(2 * MAX_DECK_LEN + 1024);
    expect(JSON.stringify(body).length).toBeLessThan(MAX_BODY_BYTES / 10);
    expect((await put(db.env, 'alex', body)).status).toBe(200);
    expect(storedCards(db).map((c) => [c.id, c.text.slice(0, 30)])).toEqual([
      ['c1', 'Open with the stats'],
      ['pad', 'x'.repeat(30)],
    ]);
  });

  // Work Tracker #574: Sam's card on top of Alex's deck at the cap would store a deck past it, which every later save
  // from an editor that loaded it would then fail on.
  it('refuses a merge that would store a deck past the cap, writing nothing', async () => {
    const db = await setUp();
    const base = sized([{ id: 'c1', text: 'Open with the story' }], MAX_DECK_LEN - 100);
    expect((await put(db.env, 'alex', { presentation: base })).status).toBe(200);
    const sam = sized(
      [
        { id: 'c1', text: 'Open with the story' },
        { id: 'c3_samm', text: 'Thank the team' },
      ],
      MAX_DECK_LEN - 100,
    );
    expect((await put(db.env, 'sam', { presentation: sam, presentationBase: base })).status).toBe(
      200,
    );
    const before = db.sql.prepare('SELECT name, presentation FROM document WHERE id = ?').get('d1');
    const alex = sized([{ id: 'c1', text: 'Open with the customer story' }]);
    const res = await put(db.env, 'alex', {
      name: 'Renamed',
      presentation: alex,
      presentationBase: base,
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'payload_too_large' });
    // Sam's card is still stored, and the refused save renamed nothing.
    expect(
      db.sql.prepare('SELECT name, presentation FROM document WHERE id = ?').get('d1'),
    ).toEqual(before);
  });

  // A deck stored past the cap before merges were held to it: its base is past the deck cap, and a shorter deck built
  // on it still saves.
  it('takes a base past the deck cap, so a deck stored past it can be saved smaller', async () => {
    const db = await setUp();
    const over = sized([{ id: 'c1', text: 'Open with the story' }], MAX_DECK_LEN + 500);
    db.sql.prepare('UPDATE document SET presentation = ? WHERE id = ?').run(over, 'd1');
    const shorter = deckOf([{ id: 'c1', text: 'Open with the story' }]);
    expect(
      (await put(db.env, 'alex', { presentation: shorter, presentationBase: over })).status,
    ).toBe(200);
    expect(storedCards(db)).toEqual([{ id: 'c1', text: 'Open with the story' }]);
  });

  it('lets a Participant or a Viewer write no cards, whole or patched', async () => {
    for (const level of ['participate', 'view'] as const) {
      const db = await setUp();
      const slide = parseStoredPresentation(deckOf([{ id: 'c1', text: 'Not mine' }]))!.decks[0]!
        .slides[0]!;
      const res = await put(
        db.env,
        'pat',
        { presentationPatch: { slides: [{ slide, baseCards: [], after: null }] } },
        level,
      );
      expect(res.status).toBe(403);
      expect(storedCards(db).map((c) => c.id)).toEqual(['c1', 'c2']);
    }
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

// speaker-note-cards.md "Saving": the unload save of a deck too large to outlive the page carries only the slides the
// editor changed, each merged into the stored deck card by card.
describe('a deck save of the changed slides alone', () => {
  const slideOf = (id: string, cards: NoteCard[]) =>
    parseStoredPresentation(
      JSON.stringify({
        decks: [{ slides: [{ id, tabId: 't1', elementIds: [], noteCards: cards }] }],
      }),
    )!.decks[0]!.slides[0]!;
  const storedDeck = (db: ReturnType<typeof sqliteD1>) =>
    parseStoredPresentation(
      (
        db.sql.prepare('SELECT presentation FROM document WHERE id = ?').get('d1') as {
          presentation: string;
        }
      ).presentation,
    )!;

  it('merges the patched slide by card and leaves the other slides as stored', async () => {
    const db = await setUp();
    // A second slide, then Sam adds a card to slide 1 the editor never saw.
    const two = JSON.stringify({
      decks: [
        {
          slides: [
            slideOf('s1', [{ id: 'c1', text: 'Open with the story' }]),
            slideOf('s2', [{ id: 'd1', text: 'Second' }]),
          ],
        },
      ],
    });
    await put(db.env, 'alex', { presentation: two });
    const sam = JSON.stringify({
      decks: [
        {
          slides: [
            slideOf('s1', [
              { id: 'c1', text: 'Open with the story' },
              { id: 'c3_samm', text: 'Thank the team' },
            ]),
            slideOf('s2', [{ id: 'd1', text: 'Second' }]),
          ],
        },
      ],
    });
    await put(db.env, 'sam', { presentation: sam, presentationBase: two });
    const patch = {
      slides: [
        {
          slide: slideOf('s1', [{ id: 'c1', text: 'Open with the customer story' }]),
          baseCards: [{ id: 'c1', text: 'Open with the story' }],
          after: null,
        },
      ],
    };
    expect((await put(db.env, 'alex', { presentationPatch: patch })).status).toBe(200);
    const [s1, s2] = storedDeck(db).decks[0]!.slides;
    expect(s1!.noteCards).toEqual([
      { id: 'c1', text: 'Open with the customer story' },
      { id: 'c3_samm', text: 'Thank the team' },
    ]);
    expect(s2!.noteCards).toEqual([{ id: 'd1', text: 'Second' }]);
  });

  it('refuses a patch with a deck, an unreadable one, one past the cap, or one that merges past it', async () => {
    const db = await setUp();
    const entry = { slide: slideOf('s1', [{ id: 'c1', text: 'x' }]), baseCards: [], after: null };
    expect(
      (await put(db.env, 'alex', { presentation: loaded, presentationPatch: { slides: [entry] } }))
        .status,
    ).toBe(400);
    expect((await put(db.env, 'alex', { presentationPatch: { slides: 'no' } })).status).toBe(400);
    const long = { ...entry, slide: slideOf('s1', [{ id: 'c1', text: 'x'.repeat(MAX_DECK_LEN) }]) };
    expect((await put(db.env, 'alex', { presentationPatch: { slides: [long] } })).status).toBe(413);
    // Under the cap alone, past it with the stored deck: a new slide of 200 KB beside one of 100 KB.
    await put(db.env, 'alex', {
      presentation: JSON.stringify({
        decks: [{ slides: [slideOf('s1', [{ id: 'c1', text: 'y'.repeat(100_000) }])] }],
      }),
    });
    const big = { ...entry, slide: slideOf('s2', [{ id: 'c1', text: 'x'.repeat(200_000) }]) };
    expect((await put(db.env, 'alex', { presentationPatch: { slides: [big] } })).status).toBe(413);
    expect(storedDeck(db).decks[0]!.slides.map((s) => s.id)).toEqual(['s1']);
  });
});
