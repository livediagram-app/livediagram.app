# Speaker note cards

A slide's speaker notes are a short stack of **note cards**: the smaller form of [Flashcards](../007-editor/flashcards.md),
made for talking a room through a deck. Each card holds one point to make; a slide can have as many as it needs, and
the presenter flips through them while the slide is on screen. One long box of script is hard to glance at in front
of a room; a card per point is what speakers already hold in their hand.

Note cards replace the single notes box of [Presentation mode](presentation-mode.md) "Presenter notes" and the
title-bar **Notes** popover of [Pages](../007-editor/pages-mode.md) "Slides". They are still the slide's notes:
written in the same places, shown in the same presenter view, exported to and imported from the same PowerPoint notes
pages.

## Domain language

| Term                | Means                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **note card**       | One card of a slide's speaker notes: plain text, one point to make. "Card" for short in the UI.                                   |
| **a slide's cards** | Its note cards in order (`Slide.noteCards`), the slide's own, never a page's or an element's.                                     |
| **card in front**   | While presenting, the note card the presenter is on. Every slide starts on its first card.                                        |
| **flip**            | Moving to another note card while presenting, turned as a flashcard turns ([Flashcards](../007-editor/flashcards.md) "Flipping"). |

The interface keeps **Notes** for the whole ("Notes", "Speaker Notes"), says **card** for one of them ("Add Card",
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

The cards are written in one place, an Editor's: the page's title-bar **Notes** button
([Pages](../007-editor/pages-mode.md) "Slides"), on any page the deck has a slide of. It shows the **note card list**.
(The Slide Deck panel's notes area was the second place; it is retired with the panel, 2026-11-04.)

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
  removed (nothing to undo). Esc in an open card closes only the card; the next Esc closes the popover or sheet.
- **A long stack** scrolls inside the list (up to 55% of the window's height, at most 30 rem), with **Add Card**
  under it, so the popover never runs off the screen.
- **Add Card**: a dashed card-shaped button under the last card ("Add Card", a plus); it adds a blank card at the end
  and opens it. ⌘↵ (Ctrl+Enter) in an open card adds a blank card straight after it and opens that. At 20 cards the
  button is disabled with the tooltip "A slide holds up to 20 cards" and ⌘↵ does nothing.
- **Reorder**: drag a card by its grip (the six dots at its top left, shown on hover or focus on a desktop and always
  on touch): a caret shows where it lands, the move commits on release, as Contents' rows reorder
  (`useRowReorderDrag`, pointer events, so touch works). **Move Up** and **Move Down** buttons sit beside the grip,
  and Alt+↑ / Alt+↓ move the focused card; the first card has no Move Up, the last no Move Down.
- **Remove**: the bin button on the card. A card with words on it goes at once and a bar under the list offers
  **Undo** for 6 seconds ("Card removed"); a blank card goes without one. Delete or Backspace on a focused (closed)
  card removes it the same way.
- **Keyboard**: Tab reaches each card and its buttons in order; ↑ / ↓ on a focused card move focus to the card above
  or below.
- The keyboard shortcuts dialog and help list ↑ / ↓ under "While presenting" (next and previous note card).
- Copy is Title Case on buttons and headings; every icon button has a styled Tooltip and a pointer cursor; light and
  dark both read; the list fits a 450 px wide window and a 390 px phone without sideways scrolling.

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

## Two people writing at once

Two Editors can write cards on the same slide at the same time, each in their own editor, and both keep their work.
The deck is saved whole, so the server merges the slide's cards **card by card** (by card id) on every deck write:

- Each deck save carries the deck it was **built on**: the deck the editor last saved, or loaded when nothing has been
  saved yet. Against it the server tells what this editor changed from what someone else changed in the meantime.
- **A card this editor changed** (its text, or a card it added) is written as this editor has it.
- **A card this editor did not change** keeps the stored card, so another person's edit to it is not overwritten by an
  older copy.
- **A card another person added** since that deck stays, after the card it followed in the stored list (or first when
  none of those is left).
- **A card removed** by either person goes, unless the other person changed it since (then their edit keeps it).
- **The order** is this editor's, with the cards only the other person has placed as above. The slides themselves,
  their names, budgets and everything else in the deck are written as this editor has them, as before.
- **The same card** written by both at once is last-write-wins: the later save's text stands.
- A slide still holds at most 20 cards after a merge: past that, the stored list's extras are read off by the usual
  parse.
- A save that carries no base (an older editor, a script) is written as sent, as before.
- New card ids are unique to the editor that made them (a counter and a few random characters), so two people adding a
  card at once never make one id for two cards.

The merge is the server's: the other person's cards reach an open editor on its next load, not live (the deck has no
room op, [Presentation mode](presentation-mode.md)). A presenter who reloads sees everyone's cards.

### Saving

The cards save on their own, with nothing to press. Typing saves the deck a moment after the last key (under a
second), so a sentence is one save, not one a key. What is still waiting goes **at once** when the writing stops being
on screen, so nothing typed is lost to the wait:

- A card closes (Done, Escape, a press outside it, or another card opened).
- The Notes popover (or the phone's sheet) closes, or it moves to another slide's notes.
- The page goes: closed, reloaded, sent to another site or put away by the browser (`pagehide`), or the editor left
  for another page of the app.

Each save carries the deck and the deck it was built on (above), so a save is up to twice the deck. The api bounds
each of the two by the deck cap (256 KB) on its own, never their sum, so a deck at the cap still saves with its base
and is merged; the whole request stays far under the api's 8 MB body cap.

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

| Role            | With note cards                                                                          |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Editor**      | Everything above: adds, writes, reorders and removes cards, in the title bar's Notes.    |
| **Participant** | Reads and flips through the cards in the presenter view. Never sees the title-bar Notes. |
| **Viewer**      | The same as a Participant: presenting is every role's, changing the deck is an Editor's. |

The deck is document metadata saved through the document's PUT, which is `gateEdit`; the deck it was built on
("Two people writing at once") travels in the same PUT, under the same gate.

## Telemetry

- `UI · Changed · SlideNotes` once per opening of a card, on its first keystroke (as before).
- `UI · Added · NoteCard`, `UI · Removed · NoteCard`, `UI · Moved · NoteCard` (a reorder).
- `UI · Opened · PageNotesButton` and `UI · Opened · PresenterNotes` as before; `UI · Used · NoteCardFlip` once per
  flip in the presenter view.
- Never text.

## Non-goals

- Rich text, titles or pictures on a note card (a flashcard has them; a note card is a line or two to glance at).
- A card per page of a flashcard stack, or turning a slide's cards into a flashcard tab.
- A second-window presenter console (still out of scope, [Presentation mode](presentation-mode.md)).
- Showing another person's cards live while both write: they arrive with the next load ("Two people writing at once").
