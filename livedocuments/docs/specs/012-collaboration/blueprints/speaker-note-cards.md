# Speaker note cards blueprint

Derived from [Speaker note cards](../speaker-note-cards.md). The model is pure and lives beside the deck in
`packages/document`; the list edits are pure in the editor's `lib/`; the UI is three focused components under
`apps/editor/components/slide-notes/`, composed into the three surfaces that showed the old notes box.

## Domain and naming

| Term            | Identifier                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| note card       | `NoteCard` `{ id, text }`, `packages/document/src/slide-notes.ts`                                              |
| a slide's cards | `Slide.noteCards`; read with `slideNoteCards(slide)` (old `notes` as one card, id `notes`)                     |
| blank           | `isBlankNoteCard(card)` (text has no non-space character)                                                      |
| cards to show   | `spokenNoteCards(slide)` (not blank, in order)                                                                 |
| has notes       | `slideHasNotes(slide)` (a card not blank)                                                                      |
| mirror          | `noteCardsText(cards)` (not blank, trimmed, joined by `\n\n`)                                                  |
| write           | `withNoteCards(slide, cards)` (sets `noteCards` and `notes`, or removes both when empty)                       |
| speaking time   | `noteCardSpeakingSeconds(text)`; labelled with `speakingTimeLabel` (`flashcards.ts`)                           |
| new id          | `newNoteCardId(cards)` (`c` + base-36 counter past the highest, `_` + 4 random base-36 characters)             |
| merge           | `mergeNoteCards(base, mine, theirs)`, `mergePresentationNoteCards(mine, base, theirs)`, `slide-notes-merge.ts` |
| deck base       | the PUT body's `presentationBase`; the editor's `deckBaseRef` (`useEditorState`)                               |
| list edits      | `apps/editor/lib/note-card-edits.ts`: `addNoteCard`, `setNoteCardText`, `moveNoteCard`, `removeNoteCard`       |
| note card list  | `NoteCardList` (`components/slide-notes/NoteCardList.tsx`), its card `NoteCardItem`                            |
| card viewer     | `PresenterNoteCards` (`components/slide-notes/PresenterNoteCards.tsx`)                                         |
| card glyph      | `NoteCardsIcon` (`components/slide-notes/NoteCardsIcon.tsx`)                                                   |
| deck verb       | `useSlideDeck().setSlideNoteCards(slideId, cards)` (replaces `setSlideNotes`)                                  |
| page controls   | `PageDeckControls.slideOf(pageId).noteCards`, `PageDeckControls.setNoteCards`                                  |

## Constants and configuration

| Constant                  | Value  | Where                    | Why / safe range                                                              |
| ------------------------- | ------ | ------------------------ | ----------------------------------------------------------------------------- |
| `NOTE_CARDS_MAX`          | 20     | `slide-notes.ts`         | A long slide's talking points; 10 to 50. Bounds the list and the deck's size  |
| `NOTE_CARD_TEXT_MAX`      | 1000   | `slide-notes.ts`         | About 170 words, over a minute spoken; 400 to 4000. Typing only (`maxLength`) |
| `DECK_SAVE_DEBOUNCE_MS`   | 900    | `useSlideDeck.ts`        | A typed phrase is one save; 300 to 2000. Flushes (spec "Saving") cut it short |
| `MAX_DECK_LEN`            | 256 KB | `apps/api/src/limits.ts` | The deck cap (UTF-16 length): the deck sent, and the deck a merge stores      |
| `MAX_DECK_BASE_LEN`       | 1 MB   | `apps/api/src/limits.ts` | 4 x `MAX_DECK_LEN` (NC6); 1x to 8x. Well under `MAX_BODY_BYTES` (8 MB)        |
| `NOTE_CARD_COUNTER_FROM`  | 800    | `NoteCardItem.tsx`       | The counter shows from here (80 % of the cap)                                 |
| `NOTE_CARD_PREVIEW_LINES` | 6      | `NoteCardItem.tsx`       | A closed card's text, then faded                                              |
| `NOTE_CARD_EDIT_LINES`    | 12     | `NoteCardItem.tsx`       | The open box grows to this many lines, then scrolls                           |
| `NOTE_CARD_UNDO_MS`       | 6000   | `NoteCardList.tsx`       | Long enough to notice and press Undo                                          |
| `VIEWER_STACK_MAX`        | 3      | `PresenterNoteCards.tsx` | Sheets behind the card in front; uses `FLASHCARD_STACK_STEP_Y` / `_INSET_X`   |
| `VIEWER_DOTS_MAX`         | 10     | `PresenterNoteCards.tsx` | Dots between the buttons; more and "Card n of m" says enough                  |
| `NOTES_POPOVER_WIDTH`     | 360    | `PageNotesButton.tsx`    | Room for a card's line at 13 px                                               |
| flip                      | 420 ms | `FLASHCARD_FLIP_MS`      | Shared with flashcards                                                        |

## Data and persistence

- `Slide.noteCards?: NoteCard[]` beside `notes?: string` in `slide-deck.ts`. Stored in the deck blob
  (`documents.presentation`), which the api keeps opaque (`MAX_DECK_LEN` 256 KB bounds it: 20 cards x 1000 chars x
  2 for the mirror is 40 KB a slide at the worst, typical decks a few KB).
- **Parse** (`parseStoredPresentation`): a slide whose `noteCards` is not an array keeps the slide and drops the field;
  entries that are not `{ id: non-empty string, text: string }` are dropped; duplicate ids keep the first; the list is
  cut to `NOTE_CARDS_MAX`. An empty list after cleaning is dropped.
- **Read** (`slideNoteCards`): `noteCards` when present (even empty), else `notes` as `[{ id: 'notes', text }]` when
  it has a non-space character, else `[]`.
- **Write** (`withNoteCards`): `noteCards = cards`, `notes = noteCardsText(cards)`; both deleted when `cards` is empty;
  `notes` deleted when every card is blank. A pure function: the slide object is copied.
- **Import** (`deckWithPageSlideDetails`): imported notes set `notes` and delete any `noteCards`, so they read as one
  card.
- **Community** (`redactDocumentForCommunity` in `apps/api/src/redact-document.ts`): drops `notes` and `noteCards`.
- No migration; an older editor reads the mirror.

### Concurrent writes (spec "Two people writing at once")

- The editor keeps `deckBaseRef`: the serialised deck it last saved (or the stored deck it loaded). Each deck save sends
  `{ presentation, presentationBase }` and then moves the ref on to what it sent. The Offline Mode store keeps no base.
- `PUT /api/documents/:id` with both strings: `mergeDocumentPresentation` (`document-room/document-content.ts`) reads the
  stored deck, merges and writes it in the document's Durable Object with no other I/O in between, so two saves never
  interleave their read and write. A base that does not parse, or no stored deck, writes `presentation` as sent.
  A merged deck longer than `MAX_DECK_LEN` is not written: the function returns `'too_large'` and the route answers
  **413** `payload_too_large`, as it does for a `presentation` past `MAX_DECK_LEN` or a `presentationBase` past
  `MAX_DECK_BASE_LEN`. The deck checks and write run before the rename, so a refused save changes nothing.
- `presentationPatch` (the unload save of a large deck, below) in place of `presentation`:
  `{ slides: { slide: Slide; baseCards: NoteCard[]; after: string | null }[] }`, its JSON at most `MAX_DECK_LEN`
  (413 past it). Sent with `presentation` it is 400 `bad_request`; unreadable (`parseDeckSlidePatch` null) 400.
  `patchDocumentPresentation` reads the stored deck and applies `applyDeckSlidePatch(stored, patch)` (first deck): each
  patched slide replaces the stored slide of its id, its cards `mergeNoteCards(baseCards, slide's cards, stored
slide's cards)` (so the `notes` mirror follows through `withNoteCards`); a slide the stored deck no longer holds goes
  after the stored slide `after` names, else first (NC7); no stored deck starts one. The same cap check, then the
  write, in the same object with no other I/O between.
- `deckSlidePatch(mine, base)` (`packages/document/src/slide-deck-patch.ts`, pure): null unless both have one deck at
  most and the same slide ids in the same order; else the slides whose JSON differs from the base's, each with
  `slideNoteCards(base slide)` and the id of the slide before it in `mine`. Null too when nothing differs.
- `mergePresentationNoteCards(mine, base, theirs)`: for each slide of `mine` (deck by index, slide by id), when the
  merged cards differ from `mine`'s, the slide is `withNoteCards(slide, merged)` (so the `notes` mirror follows); every
  other field of the deck is `mine`'s. Cards read through `slideNoteCards`, so an old `notes` slide is its one card.
- `mergeNoteCards(base, mine, theirs)` (by id): a card in `mine` whose text differs from `base` (or is not in `base`)
  keeps `mine`'s text; a card in `mine` the same as in `base` takes `theirs`' text, and goes when `theirs` removed it; a
  card in `base` and `theirs` but not `mine` (removed here) goes unless `theirs` changed it; a card only in `theirs`
  is placed after its nearest earlier neighbour in `theirs` that the result holds, else first. Cut to `NOTE_CARDS_MAX`.

### Saving (spec "Saving")

- `useSlideDeck.commitDeck` keeps the deck awaiting its save in `pendingRef` and (re)starts the `DECK_SAVE_DEBOUNCE_MS`
  timer; `sendPending(unload)` clears the timer, takes `pendingRef` and hands `storePresentation` of it to `saveDeck`.
- `flushDeckSave()` (on the hook, and `PageDeckControls.flushNotes`): queues a no-op deck update whose updater runs
  `sendPending(false)`, so it runs after every deck update queued before it (the blank card a close removes goes in
  the same save). Nothing pending sends nothing.
- `NoteCardList`'s optional `onSettle` runs when a card closes (`close`, which Done, Escape and an outside press call,
  and `open` of another card while one is open) and when the list unmounts (the popover closes, or `PageNotesButton`'s
  `key={slide.id}` moves it to another slide), after the blank-card removal. `PageNotesButton` passes
  `deck.flushNotes`.
- `pagehide` on `window` and the hook's unmount call `sendPending(true)`: `saveDeck(serialised, { unload: true })`,
  which `useEditorState` passes to `apiSaveDocumentMeta(..., { unload: true })`. That branch runs synchronously
  (`saveDocumentMetaOnUnload` in `lib/api/unload-requests.ts`): Offline Mode writes the deck to IndexedDB by the sync
  id check; otherwise one PUT with headers built synchronously (`unloadHeaders`, as the tab beacon) and `keepalive`
  while the body fits the page's shared keepalive budget (`takeKeepalive`, 60 KB per task, shared with the tab
  beacon). A whole body past what is left of the budget goes as `{ presentationPatch: deckSlidePatch(mine, base) }`
  when that is not null and fits (kept alive); otherwise the whole body as a plain request. The decks are parsed only
  on that path. The base order holds: `sendDeckSave` moves `deckBaseRef` on before any request goes.
- `saveDeck` (`useEditorState`) runs `sendDeckSave(deckBaseRef, serialised, send, toast.error)`
  (`app/document/[id]/deck-save.ts`). A failed save (not an unload one, which never reports back) puts `deckBaseRef`
  back to the base it sent when the ref still holds the deck that failed, and toasts `deckSaveFailureMessage(err)`.
  The effect that seeds `deckBaseRef` from `documentPresentation` skips the deck this editor last sent
  (`sentDeckRef`), so its own write coming back never undoes a put-back. Messages: 413 "Speaker notes are too long to save. Shorten some cards.", 403 and
  401 the tab save's own messages, a trashed document nothing (the autosave reports it), anything else
  "Couldn’t save your speaker notes. Check your connection.". The toast layer folds a streak of the same message.
- A read-only session never commits the deck (`setDeck` only), so there is never anything to flush.

## Interfaces and contracts

```ts
// packages/document/src/slide-notes.ts
export type NoteCard = { id: string; text: string };
export const NOTE_CARDS_MAX = 20;
export const NOTE_CARD_TEXT_MAX = 1000;
export function parseNoteCards(raw: unknown): NoteCard[] | undefined;
export function slideNoteCards(slide: Pick<Slide, 'notes' | 'noteCards'>): NoteCard[];
export function spokenNoteCards(slide: Pick<Slide, 'notes' | 'noteCards'>): NoteCard[];
export function slideHasNotes(slide: Pick<Slide, 'notes' | 'noteCards'>): boolean;
export function isBlankNoteCard(card: NoteCard): boolean;
export function noteCardsText(cards: readonly NoteCard[]): string;
export function withNoteCards(slide: Slide, cards: readonly NoteCard[]): Slide;
export function newNoteCardId(cards: readonly NoteCard[]): string;
export function noteCardSpeakingSeconds(text: string): number;

// apps/editor/lib/note-card-edits.ts (all pure; the same array back when nothing changes)
export function addNoteCard(
  cards,
  afterIndex: number | null,
): { cards: NoteCard[]; id: string } | null; // null at NOTE_CARDS_MAX
export function setNoteCardText(cards, id, text): NoteCard[];
export function moveNoteCard(cards, from: number, to: number): NoteCard[];
export function removeNoteCard(
  cards,
  id,
): { cards: NoteCard[]; removed: { card: NoteCard; index: number } | null };
export function restoreNoteCard(cards, removed): NoteCard[]; // back at its index (clamped), unless full or present
```

`PresentationHud` takes `cards: readonly NoteCard[]` (the spoken ones) in place of `notes`, plus `cardAt`,
`onCard(index)`. `PptxSlide.notes` becomes `string[]` (one entry a card); `notesSlideXml(cards)` writes one `<a:p>` a
card, each line a run joined by `<a:br/>`.

## Behaviour and state

### NoteCardList (`{ cards, onChange, compact?, autoFocusEmpty? }`)

- State: `openId` (the card open for writing, at most one), `undo` (`{ card, index }` or null, with its timer),
  `tracked` (the card ids already counted for `SlideNotes`), and the drag (`useRowReorderDrag`, slot
  `note-card-slot`, disabled while a card is open).
- Opening a card closes the open one; closing a blank card removes it without an undo.
- Add Card: `addNoteCard(cards, null)` then `openId = id`; ⌘/Ctrl+Enter in an open card: `addNoteCard(cards, index)`.
- Remove: `removeNoteCard`; with words, `undo` is set (replacing any earlier one) and cleared after
  `NOTE_CARD_UNDO_MS` or by Undo (`restoreNoteCard`).
- Keys on a closed, focused card (its root, `role="group"` with a `tabIndex` of 0): Enter opens, Delete/Backspace
  removes, Alt+↑/↓ moves, ↑/↓ moves focus. Keys in the open box: Escape closes, ⌘/Ctrl+Enter adds after; every
  other key is stopped from reaching the editor's shortcuts.
- Escape and the popover: `AnchoredPopover` and the phone sheet take Escape in the capture phase, before the box sees
  it. So `NoteCardList` takes an optional, stable `takeEscape` callback and hands it a function that closes the open
  card and returns true (false with none open), and null on unmount; `PageNotesButton` keeps it in a ref and passes
  `onEscape={() => escapeCard.current?.() ?? false}` to `TitlePopoverButton`, which hands it to `AnchoredPopover`'s
  `onEscape` and calls it first in its sheet's `useEscape`, closing only when it returns false.
- The cards sit in a scroller (`data-note-card-scroller`, `max-h-[min(55vh,30rem)]`, overscroll contained) with Add
  Card under it; the list is `select-none` while a card is dragged.
- An outside press while a card is open closes it (`useClickOutside` on the list).
- Empty (`cards.length === 0`): `CompactEmptyState` (size small) with **Add First Card**.

### PageNotesButton

- Named **Notes** always, pressed once the slide has a card that is not blank; the popover body
  is `NoteCardList`, `width` 360; on a phone `TitlePopoverButton` makes it a bottom sheet.
- Shown for an Editor on a slide in the deck on a phone too (`CanvasPages`: `notesButton` needs only the deck's slide
  of the page).

### Presenter view

- `PresentationOverlay` keeps `notesOpen` (the wish) across slides; `notesVisible = notesOpen && spoken.length > 0`.
  `go()` no longer closes notes; it sets `cardAt = 0`. ↑/↓ (only while visible) step `cardAt` within the cards;
  `N` toggles while the slide has cards. Esc order unchanged.
- `PresenterNoteCards`: renders the card in front, the sheets behind (`min(VIEWER_STACK_MAX, count - at - 1)`),
  the buttons and dots, and a polite live region "Card 2 of 4. <text>". On `at` changing it runs the flip with the
  Web Animations API on the card (forward: a picture of the old card, a copy of its text, turns up and fades; back:
  the new card turns down onto the stack), skipped under `motionReduced()` or without `Element.animate`.

## Errors and edge cases

| Case                                           | Handling                                                      |
| ---------------------------------------------- | ------------------------------------------------------------- |
| Stored `noteCards` not an array / bad entries  | Field or entries dropped at parse; slide kept                 |
| More than 20 stored                            | First 20 read                                                 |
| Old note longer than 1000 chars                | Kept whole; the box allows deleting, not adding (`maxLength`) |
| Add at 20 cards                                | `addNoteCard` returns null; button disabled with its tooltip  |
| A card removed by a collaborator while open    | `openId` no longer in the list: nothing open                  |
| Undo after the list filled up                  | `restoreNoteCard` returns the list unchanged                  |
| Presenter on a slide whose cards are all blank | No notes button; the viewer hidden                            |
| Presenter `cardAt` past the end after an edit  | Clamped to the last card                                      |
| Read-only session                              | No `deck` controls, no panel notes; the viewer still shows    |
| Merged deck past `MAX_DECK_LEN`                | 413, nothing written; the editor toasts "too long"            |
| Deck save fails (network, 5xx, 413)            | Toast; `deckBaseRef` back to the last stored base             |
| Unload save of a deck past the keepalive left  | Changed slides only (`presentationPatch`), kept alive         |
| ... that added, removed or moved slides        | The whole deck as a plain request (may not land on a close)   |
| Patched slide the stored deck no longer holds  | Placed after its `after` slide, else first (NC7)              |

## Security and trust

- Card text is plain text rendered as React text (never HTML); in the pptx it goes through `xmlText`.
- The deck write stays `gateEdit` (document PUT) and `MAX_DECK_LEN`; a Participant or Viewer has no editor door to it.
- The Community copy drops the cards.

## Performance and limits

- One `<textarea>` at most is mounted (the open card); closed cards are plain text. Typing commits the deck (one array
  map) and the deck save stays debounced (`DECK_SAVE_DEBOUNCE_MS`, 900 ms): no keystroke serialises the deck, only
  the timer or a flush does (spec "Saving").
- A save is the deck plus its base. `PUT /api/documents/:id` checks `presentation` against `MAX_DECK_LEN` (256 KB,
  UTF-16 length) and `presentationBase` against `MAX_DECK_BASE_LEN` (1 MB) each, never their sum: at most about
  1.3 MB of JSON, under `MAX_BODY_BYTES` (8 MB). The merged deck is held to `MAX_DECK_LEN` too.
- The unload save of a deck past the keepalive left parses the deck and its base once (two `JSON.parse` of at most
  256 KB and 1 MB) and compares slides by `JSON.stringify`, only on that path and only as the page goes. One typed
  slide's patch is its slide plus its base cards: at most about 40 KB at 20 cards of 1000 characters.
- Speaking time is a regex word count per card per render; at 20 x 1000 characters it is well under a millisecond.
- The presenter flips with one animated element and one copy of text, never a canvas picture.

## Presentation and UX

As the spec's "Writing note cards" and "Presenting". Copy: "Speaker Notes", "No Notes Yet", "Write what you'll say as
cards, one point each. You flip through them while you present.", "Add First Card", "Add Card", "Card removed",
"Undo", "Done", "Move Up", "Move Down", "Remove Card", "Drag to Reorder", "A slide holds up to 20 cards",
"What you'll say for this point…", "⌘↵ New Card · Esc Done", "Previous Card", "Next Card", "Go to Card n",
"Card n of m", "Shown to you in the presenter view; never on the slide."

## Accessibility

- Each closed card is a `role="group"` named "Card n of m", focusable; its buttons are labelled and have Tooltips.
- The open box is labelled "Card n"; the counter is `aria-live="polite"` near the limit.
- The undo bar is `role="status"`. The presenter's live region announces the card in front.
- Reduced motion: no flip, no card grow animation. Contrast: slate-700 on white, white/90 on slate-900.

## Observability

- `debugLog('[note-cards] add|remove|move|restore', { slideCards })` on each list edit (counts only, never text).
- `[presentation] note-card` debug log on each flip with `{ at, count }`.
- `debugLog('[save] large deck on unload', { patched })` when the whole deck does not fit the keepalive left.
- api: `console.warn('[deck] merged deck refused past the cap', { length })` on a merge or patch past `MAX_DECK_LEN`.

## Testing

| Rule                                                                                                 | Test                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Parse, read old notes, mirror, limits                                                                | `packages/document/src/slide-notes.test.ts`                                                                                           |
| Merge by card id (each rule), deck merge, unique ids                                                 | `packages/document/src/slide-notes-merge.test.ts`, `slide-notes.test.ts`                                                              |
| Two clients writing different cards on one slide both survive; no base is as sent                    | `apps/api/src/routes/deck-note-card-merge.test.ts`                                                                                    |
| A deck at the cap saves with a base at the cap, merged                                               | `apps/api/src/routes/deck-note-card-merge.test.ts`                                                                                    |
| A merge past the cap is refused 413 and writes nothing; a base past the cap but under 1 MB is taken  | `apps/api/src/routes/deck-note-card-merge.test.ts`                                                                                    |
| A changed-slides patch merges by card, keeps the rest, places a lost slide, holds the cap            | `apps/api/src/routes/deck-note-card-merge.test.ts`, `packages/document/src/slide-deck-patch.test.ts`, `slide-deck-patch.perf.test.ts` |
| The unload save of a large deck sends the changed slides kept alive; a moved slide sends it whole    | `apps/editor/lib/api/unload-requests.test.ts`                                                                                         |
| A failed deck save toasts and puts the base back                                                     | `app/document/[id]/deck-save.test.ts`                                                                                                 |
| A large deck's last typed card survives a tab close                                                  | `apps/editor/e2e/deck-save-on-close.spec.ts`                                                                                          |
| Saving: debounce, flush after queued updates, pagehide and unmount as unload, read-only sends none   | `app/document/[id]/useSlideDeck.save-flush.test.ts`                                                                                   |
| The list settles on a card's close and on unmount                                                    | `components/slide-notes/NoteCardList.test.tsx`                                                                                        |
| The unload save: sync headers, keepalive within the shared budget, Offline Mode to IndexedDB         | `apps/editor/lib/api/unload-requests.test.ts`                                                                                         |
| The editor sends the deck it built on                                                                | `apps/editor/lib/api-client.test.ts`                                                                                                  |
| List edits                                                                                           | `apps/editor/lib/note-card-edits.test.ts`                                                                                             |
| The list: empty state, add, open one at a time, blank removed, keys, reorder, remove and undo, limit | `components/slide-notes/NoteCardList.test.tsx`                                                                                        |
| Title-bar button names, popover, phone sheet, Esc to the open card first                             | `components/canvas/PageNotesButton.test.tsx`                                                                                          |
| Presenter viewer: buttons, dots, keys, live region, stays open across slides                         | `components/slide-notes/PresenterNoteCards.test.tsx`, `PresentationOverlay.note-cards.test.tsx`                                       |
| Export one paragraph a card; summary counts                                                          | `lib/office-export/pptx.test.ts`, `ExportTabDialog.office.test.tsx`                                                                   |
| Import as one card                                                                                   | `packages/document/src/slide-deck-pages.test.ts`                                                                                      |
| Community drops cards                                                                                | `apps/api/src/redact-document.test.ts`                                                                                                |
| Roles: no page controls without edit                                                                 | `lib/page-deck-controls.test.ts`                                                                                                      |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows NC1 to NC7.
