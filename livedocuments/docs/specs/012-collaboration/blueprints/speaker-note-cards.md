# Speaker note cards blueprint

Derived from [Speaker note cards](../speaker-note-cards.md). The model is pure and lives beside the deck in
`packages/document`; the list edits are pure in the editor's `lib/`; the UI is three focused components under
`apps/editor/components/slide-notes/`, composed into the three surfaces that showed the old notes box.

## Domain and naming

| Term            | Identifier                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| note card       | `NoteCard` `{ id, text }`, `packages/document/src/slide-notes.ts`                                        |
| a slide's cards | `Slide.noteCards`; read with `slideNoteCards(slide)` (old `notes` as one card, id `notes`)               |
| blank           | `isBlankNoteCard(card)` (text has no non-space character)                                                |
| cards to show   | `spokenNoteCards(slide)` (not blank, in order)                                                           |
| has notes       | `slideHasNotes(slide)` (a card not blank)                                                                |
| mirror          | `noteCardsText(cards)` (not blank, trimmed, joined by `\n\n`)                                            |
| write           | `withNoteCards(slide, cards)` (sets `noteCards` and `notes`, or removes both when empty)                 |
| speaking time   | `noteCardSpeakingSeconds(text)`; labelled with `speakingTimeLabel` (`flashcards.ts`)                     |
| new id          | `newNoteCardId(cards)` (`c` + base-36 counter past the highest, never reused in the list)                |
| list edits      | `apps/editor/lib/note-card-edits.ts`: `addNoteCard`, `setNoteCardText`, `moveNoteCard`, `removeNoteCard` |
| note card list  | `NoteCardList` (`components/slide-notes/NoteCardList.tsx`), its card `NoteCardItem`                      |
| card viewer     | `PresenterNoteCards` (`components/slide-notes/PresenterNoteCards.tsx`)                                   |
| card glyph      | `NoteCardsIcon` (`components/slide-notes/NoteCardsIcon.tsx`)                                             |
| deck verb       | `useSlideDeck().setSlideNoteCards(slideId, cards)` (replaces `setSlideNotes`)                            |
| page controls   | `PageDeckControls.slideOf(pageId).noteCards`, `PageDeckControls.setNoteCards`                            |

## Constants and configuration

| Constant                  | Value  | Where                    | Why / safe range                                                              |
| ------------------------- | ------ | ------------------------ | ----------------------------------------------------------------------------- |
| `NOTE_CARDS_MAX`          | 20     | `slide-notes.ts`         | A long slide's talking points; 10 to 50. Bounds the list and the deck's size  |
| `NOTE_CARD_TEXT_MAX`      | 1000   | `slide-notes.ts`         | About 170 words, over a minute spoken; 400 to 4000. Typing only (`maxLength`) |
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
  it. So `NoteCardList` takes an optional `takeEscape` ref and sets it to a function that closes the open card and
  returns true (false with none open); `PageNotesButton` passes `onEscape={() => takeEscape.current?.() ?? false}` to
  `TitlePopoverButton`, which hands it to `AnchoredPopover`'s `onEscape` and calls it first in its sheet's
  `useEscape`, closing only when it returns false.
- The cards sit in a scroller (`data-note-card-scroller`, `max-h-[min(55vh,30rem)]`, overscroll contained) with Add
  Card under it; the list is `select-none` while a card is dragged.
- An outside press while a card is open closes it (`useClickOutside` on the list).
- Empty (`cards.length === 0`): `CompactEmptyState` (size small) with **Add First Card**.

### PageNotesButton

- Name **Add Notes** while the slide has no card that is not blank, **Notes** (pressed) once it has; the popover body
  is `NoteCardList`, `width` 360; on a phone `TitlePopoverButton` makes it a bottom sheet.
- Shown for an Editor on a slide in the deck on a phone too (`CanvasPages`: `notesButton` no longer requires the
  desktop-only deck button).

### Slide Deck panel

- The notes area under the list ("Notes · Slide 3", **Done**) holds `NoteCardList compact` and the Budget row.

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

## Security and trust

- Card text is plain text rendered as React text (never HTML); in the pptx it goes through `xmlText`.
- The deck write stays `gateEdit` (document PUT) and `MAX_DECK_LEN`; a Participant or Viewer has no editor door to it.
- The Community copy drops the cards.

## Performance and limits

- One `<textarea>` at most is mounted (the open card); closed cards are plain text. Typing commits the deck (one array
  map) and the deck save stays debounced (`DECK_SAVE_DEBOUNCE_MS`, 900 ms).
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

## Testing

| Rule                                                                                                 | Test                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Parse, read old notes, mirror, limits                                                                | `packages/document/src/slide-notes.test.ts`                                                     |
| List edits                                                                                           | `apps/editor/lib/note-card-edits.test.ts`                                                       |
| The list: empty state, add, open one at a time, blank removed, keys, reorder, remove and undo, limit | `components/slide-notes/NoteCardList.test.tsx`                                                  |
| Title-bar button names, popover, phone sheet, Esc to the open card first                             | `components/canvas/PageNotesButton.test.tsx`                                                    |
| Presenter viewer: buttons, dots, keys, live region, stays open across slides                         | `components/slide-notes/PresenterNoteCards.test.tsx`, `PresentationOverlay.note-cards.test.tsx` |
| Export one paragraph a card; summary counts                                                          | `lib/office-export/pptx.test.ts`, `ExportTabDialog.office.test.tsx`                             |
| Import as one card                                                                                   | `packages/document/src/slide-deck-pages.test.ts`                                                |
| Community drops cards                                                                                | `apps/api/src/redact-document.test.ts`                                                          |
| Roles: no page controls without edit                                                                 | `lib/page-deck-controls.test.ts`                                                                |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows NC1 to NC5.
