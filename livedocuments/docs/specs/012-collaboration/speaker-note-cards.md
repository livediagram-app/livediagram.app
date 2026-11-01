# Speaker note cards

A slide's speaker notes are a short stack of **note cards**: the smaller form of [Flashcards](../007-editor/flashcards.md),
made for talking a room through a deck. Each card holds one point to make; a slide can have as many as it needs, and
the presenter flips through them while the slide is on screen. One long box of script is hard to glance at in front
of a room; a card per point is what speakers already hold in their hand.

Note cards replace the single notes box of [Presentation mode](presentation-mode.md) "Presenter notes" and the
title-bar **Add Notes** popover of [Pages](../007-editor/pages-mode.md) "Slides". They are still the slide's notes:
written in the same places, shown in the same presenter view, exported to and imported from the same PowerPoint notes
pages.

## Domain language

| Term                | Means                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **note card**       | One card of a slide's speaker notes: plain text, one point to make. "Card" for short in the UI.      |
| **a slide's cards** | Its note cards in order (`Slide.noteCards`), the slide's own, never a page's or an element's.        |
| **card in front**   | While presenting, the note card the presenter is on. Every slide starts on its first card.          |
| **flip**            | Moving to another note card while presenting, turned as a flashcard turns ([Flashcards](../007-editor/flashcards.md) "Flipping"). |

The interface keeps **Notes** for the whole ("Add Notes", "Speaker Notes"), says **card** for one of them ("Add Card",
"Card 2 of 4"), and never calls a note card a flashcard, a page or a slide.

## How it differs from a flashcard

A flashcard is a page of a tab, with rich text, a title and its own editor. A note card is a few lines of **plain
text** on the deck's slide: no title, no formatting, no page, no editor of its own. What it keeps from flashcards:
one point a card, the speaking time in its corner, the stack showing what is still to come, and the flip.

## The model

- `Slide.noteCards?: { id: string; text: string }[]`, in order. Absent or empty means no notes.
- **Old notes read as one card.** A slide written before note cards carries `notes?: string` only; it reads as one
  card holding that text (id `notes`). Nothing is migrated on load; the first edit writes `noteCards`.
- **`notes` mirrors the cards.** Every write keeps `notes` as the cards' text joined by a blank line, so an older
  editor, and anything else reading `notes`, still shows the whole script. While `noteCards` is present it is the
  truth; `notes` is never read beside it.
- A card's text is kept as typed (line breaks too); a card with nothing but spaces is **blank**. Blank cards are kept
  while being written (a new card starts blank) and left out of the presenter view, the export and every count.
- **Limits**: at most **20** cards a slide (`NOTE_CARDS_MAX`); a card takes up to **1,000** characters as typed
  (`NOTE_CARD_TEXT_MAX`). A longer old note or imported notes page is kept whole as one card, never cut; it can only be
  shortened. A stored deck with more than 20 cards on a slide reads its first 20.
- Each card's **speaking time** is its words at 130 words a minute, as a flashcard's is
  ([Flashcards](../007-editor/flashcards.md) "Card number and speaking time"): "25 sec", "2 min".

## Writing note cards

The cards are written in two places, both an Editor's: the slide page's title-bar **Notes** button
([Pages](../007-editor/pages-mode.md) "Slides") and the Slide Deck panel's notes area (opened from a row's `…` menu,
**Add notes** / **Edit notes**). Both show the same **note card list**.

- **Desktop**: the title-bar button opens a 360 px popover under it. **Phone**: the same button (icon only) opens a
  bottom sheet. On a phone the title bar offers **Notes** for a slide in the deck even though it offers no deck
  button, so a speaker can write their cards on the train.
- **Header**: "Speaker Notes", then the count and the slide's total speaking time ("3 cards · 2 min"), or nothing
  while there are none.
- **Empty state**: a stack-of-cards badge, **No Notes Yet**, the line "Write what you'll say as cards, one point
  each. You flip through them while you present.", and **Add First Card**.
- **A card**: a small index card (white, a hairline border, a thin brand rule across its top, a soft shadow), its
  number at the top left ("1"), its speaking time at the bottom right, its text below the number (up to 6 lines,
  then faded). Pressing the card, or Enter while it has focus, opens it for writing.
- **Writing a card**: the card grows into a text box in place, the caret at the end, the box as tall as its text
  (up to 12 lines, then it scrolls). **Only one card is open for writing at a time**: opening another closes the
  first. Under the box: the hint "⌘↵ New Card · Esc Done" (Ctrl on Windows and Linux; left out on touch), and once
  past 800 characters a counter ("840 / 1,000"), amber at the limit. Every keystroke writes the deck.
- **Leaving a card**: **Done**, Esc, pressing outside it or opening another card closes it. A card closed blank is
  removed (nothing to undo).
- **Add Card**: a dashed card-shaped button under the last card ("Add Card", a plus); it adds a blank card at the end
  and opens it. ⌘↵ (Ctrl+Enter) in an open card adds a blank card straight after it and opens that. At 20 cards the
  button is disabled with the tooltip "A slide holds up to 20 cards" and ⌘↵ does nothing.
- **Reorder**: drag a card by its grip (the six dots at its top left, shown on hover or focus on a desktop and always
  on touch): a caret shows where it lands, the move commits on release, as the Slide Deck's rows reorder
  (`useRowReorderDrag`, pointer events, so touch works). **Move Up** and **Move Down** buttons sit beside the grip,
  and Alt+↑ / Alt+↓ move the focused card; the first card has no Move Up, the last no Move Down.
- **Remove**: the bin button on the card. A card with words on it goes at once and a bar under the list offers
  **Undo** for 6 seconds ("Card removed"); a blank card goes without one. Delete or Backspace on a focused (closed)
  card removes it the same way.
- **Keyboard**: Tab reaches each card and its buttons in order; ↑ / ↓ on a focused card move focus to the card above
  or below.
- Copy is Title Case on buttons and headings; every icon button has a styled Tooltip and a pointer cursor; light and
  dark both read; the list fits a 450 px wide window and a 390 px phone without sideways scrolling.

The Slide Deck panel keeps the slide's **Budget** under the list, as before.

## Presenting

The HUD's notes button ([Presentation mode](presentation-mode.md) "The HUD") shows only on a slide with a card that is
not blank; `N` toggles it. It opens the **card viewer** under the HUD:

- **The card in front**, 352 px wide, as an index card on the HUD's dark glass: "Card 2 of 4" at the top left, its
  speaking time at the top right, its text in 15 px type, scrolling past half the screen's height.
- **The cards still to come** peek out below it as a stack, each sheet a little lower, narrower and dimmer (10 px,
  14 px, as a flashcard stack, at most 3 shown); the last card has none behind it.
- **Previous Card** and **Next Card** buttons under it, with a dot per card (up to 10, each a "Go to Card n" button)
  between them; ↑ and ↓ flip back and forward while the viewer is open. At the first and last card the button is
  disabled; a slide with one card shows no buttons or dots.
- **Flip**: forward, the card in front turns up over its top edge and fades, uncovering the next; back, the earlier
  card comes back down over it, 420 ms (`FLASHCARD_FLIP_MS`). Reduced motion swaps at once.
- **The viewer stays open as the slide changes** and shows the new slide's first card, so a speaker can keep their
  cards up for the whole talk; it hides (without forgetting it was open) on a slide with no cards and comes back on
  the next slide that has some. Esc, the notes button and `N` close it.
- Auto-advance pauses while it is open, as it does for any popover. Screen readers hear the card's position and text
  in a polite live region as it changes.

## PowerPoint

- **Export** ([Office export](../020-import-export/office-export.md)): a slide's cards (not blank) become its notes
  page, **one paragraph a card**, in order; a line break inside a card is a line break in that paragraph. The export
  summary counts slides whose cards are not all blank.
- **Import** ([Office import](../020-import-export/office-import.md)): a slide's notes page comes in as **one card**
  holding its text (its paragraphs as lines), as notes did before; the speaker can split it into cards afterwards.

## Community

A Community copy of a document ([Community](../025-community/community.md)) drops each slide's cards with its notes:
they are what the presenter means to say, not what the document shows.

## Share roles

([Share roles](../013-workspace/share-roles.md))

| Role            | With note cards                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **Editor**      | Everything above: adds, writes, reorders and removes cards, in the title bar and the Slide Deck.    |
| **Participant** | Reads and flips through the cards in the presenter view. Never sees the title-bar Notes or the Slide Deck. |
| **Viewer**      | The same as a Participant: presenting is every role's, changing the deck is an Editor's.          |

The deck is document metadata saved through the document's PUT, which is `gateEdit`; nothing new reaches the server.

## Telemetry

- `UI · Changed · SlideNotes` once per opening of a card, on its first keystroke (as before).
- `UI · Added · NoteCard`, `UI · Removed · NoteCard`, `UI · Reordered · NoteCard`.
- `UI · Opened · PageNotesButton` and `UI · Opened · PresenterNotes` as before; `UI · Used · NoteCardFlip` once per
  flip in the presenter view.
- Never text.

## Non-goals

- Rich text, titles or pictures on a note card (a flashcard has them; a note card is a line or two to glance at).
- A card per page of a flashcard stack, or turning a slide's cards into a flashcard tab.
- A second-window presenter console (still out of scope, [Presentation mode](presentation-mode.md)).
- Live merging of two people writing cards on the same slide at once: the deck stays last-write-wins.
