# Find and replace

**Find** looks for a word or phrase across every page of the open tab: an article's writing and
the words of the elements on its pages, every match highlighted where it sits, with a count, next
and previous, and the page turned to the one in hand. **Replace** swaps the match in hand, or every
match at once, for other words. Every writing tool has it, and people notice quickly when it is
missing.

## Domain language

| Term              | Means                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Find bar**      | The small card over the canvas that holds the search, its count, next and previous, the options and, opened, the Replace row.                                     |
| **query**         | What is typed into the Find field: plain text, never a pattern.                                                                                                   |
| **match**         | One place the query occurs: a stretch of one block of an article's writing, or of one text of one element on a page.                                              |
| **current match** | The match in hand: drawn stronger than the rest, counted as "3" in "3 of 12", the one Replace swaps.                                                              |
| **searched text** | A block's text (a paragraph, a list item, a code block), or one of an element's texts: its label, title and subtitle, code, a table's cells, a checklist's items. |
| **replaceable**   | A match this person may change: its text is one their role may write, and nothing holds it (a lock).                                                              |
| **held match**    | A match found but not replaceable: shown and counted like any other, passed over by Replace and Replace All.                                                      |

## Opening and closing

- **Cmd/Ctrl+F** opens the Find bar with the caret in its field, whenever the document has the
  keyboard: the canvas, a selection, or the article's writing. Pressed with the bar already open it
  selects the field's text again. Text selected in the writing (one line, up to 200 characters)
  becomes the query.
- **The browser's own find stays the browser's** wherever the editor does not have the keyboard:
  in any other text field (a comment, a panel, a dialog's input, a label being edited), while a
  dialog is open, while a deck presents, and in an embed.
- **Cmd/Ctrl+Shift+H** opens the bar with the Replace row, for someone who may replace; for a
  Viewer it opens Find alone.
- **The search panel's commands** open it too: **Find in Tab** for everyone and **Find and
  Replace** for someone who may replace ([Command palette](command-palette.md)). On a touch screen
  with no keyboard, this is the way in. The **chevron** at the bar's left shows or hides the Replace row
  (an Editor and a Participant only).
- **Escape** (focus anywhere in the bar) or the bar's **Close** closes it: the highlights go, and
  the keyboard goes back to the canvas. The query and options are kept for the next opening while
  the document stays open, and searched again as it opens.
- Switching tabs keeps the bar open and searches the new tab.
- The bar shows in Pages (the only mode) and never while a deck presents.

## What is searched

- **Every page of the open tab, in the row's order.** On each page: first the article writing that
  starts on it, block by block, then the words of the elements on it, top to bottom, then left to
  right. An element is on the page its centre falls on (as Find a Page reads it, [Pages](pages-mode.md)
  "Contents"); an element on no page is not searched.
- **An article's writing**: its paragraphs (titles and headings included), list items and code
  blocks. A match may run across formatting (part bold, part plain) but never across two blocks.
  A line break inside a block (Shift+Enter) is a character of the block, so a query never matches
  across it.
- **An element's words**: its label (a rich label is searched as its plain text), its title and
  subtitle, its code, every cell of a table, every item of a checklist.
- **Never searched**: notes, comments, alt text, link addresses, chart data, and anything hidden
  from the page. Placeholders ("Title", "Start writing...") are not text.
- **The writing as written to the tab**: words typed in the last moment (before the writing's
  idle commit) are searched once they are written.

## Matching

- **Plain text**, never a pattern: every character of the query means itself.
- **Match Case** off (the default): letters match whatever their case. On: exactly.
- **Whole Word** off (the default): a match may be part of a longer word. On: only a match with no
  letter, digit or underscore just before or after it.
- Matches never overlap: after one, the next is looked for past its end.
- A query of up to **500** characters. An empty query finds nothing and shows no count.
- **At most 5,000 matches** are counted and highlighted; past that the count reads "5,000+".

## The count and stepping

- The count sits in the field's end: **"3 of 12"**; **"No Results"** when nothing matches; nothing
  while the field is empty.
- **A new search** (the query or an option changed, or the bar opened) makes the first match on or
  after the page in view the current one, and goes to it.
- **Enter** or the **Next** button goes to the next match; **Shift+Enter** or **Previous** to the
  one before; both wrap round at the ends.
- **Going to a match** brings it into view: a match on another page frames that page whole (as a
  page's label does), turning a flashcard to its card; a match on the page in view pans the least
  that shows it. The keyboard stays in the Find field.
- **The search follows the tab.** An edit (anyone's) searches again; the current match stays the
  one at the same place where it can, else the next.

## Highlights

- **In the writing**, every match is tinted in a soft find yellow (`#fde047` at 45%) and the current
  match in a strong orange (`#fb923c` at 70%) with a 1 px outline, drawn under the text so its ink
  is untouched, on a light or a dark page.
- **On an element**, a match is shown by a ring round the element: 2 px dashed find yellow round
  each element holding a match, 2 px solid orange round the one holding the current match, each over
  a 1 px halo in the canvas colour so it reads on any page (as an agent's focus ring does).
- **A held match** (Replace row open) is drawn in the same places, its tint and ring in slate
  instead, so what Replace All will change is plain to see.
- Highlights are the finder's own: never stored, synced, exported, printed or presented.

## Replace

- The Replace row: a **Replace With** field, **Replace** and **Replace All**.
- **Replace** swaps the current match for the Replace With text and goes to the next match. On a
  held match it is disabled, its tooltip saying why ("You can't edit this text" or "This text is
  locked").
- **Replace All** swaps every replaceable match at once, as **one edit**: one undo step takes every
  one of them back. Matches are found again from the tab as it is at that moment, so nothing typed
  since the last search is lost or swapped blind. A toast says what happened: "Replaced 12 matches.",
  and with held ones, "Replaced 8 matches. 4 matches in text you can't edit were left as they are."
- **Formatting is kept**: the new words take the formatting of the first character they replace
  (bold stays bold, a link stays a link, a comment's tint stays on its text).
- An empty Replace With deletes the matches. A text box that sizes to its words fits its new words.
- **Live for everyone**: the change syncs as any edit does, block by block in an article and field
  by field on elements, so a collaborator sees it land at once.
- **Undo** takes back a Replace or a Replace All whole, as any edit.

## Share roles

([Share roles](../013-workspace/share-roles.md))

| Role            | With find and replace                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | Finds, and replaces anywhere it finds, but in a locked tab, page, layer or element.                                                                                                                                                                                                                                                                                                                                                             |
| **Participant** | Finds everywhere. Replaces only in text it may write: an article's writing and the text fields of elements (`PARTICIPANT_TEXT_FIELDS`: labels, a table's cells, a card's title and subtitle, code). A match anywhere else (a checklist's items) is a held match: found, counted, drawn in slate, passed over, and the bar says how many ("4 can't be replaced: text you can't edit, or locked"). Never on a locked tab, page, layer or element. |
| **Viewer**      | Finds: the bar has no chevron, no Replace row, and Cmd/Ctrl+Shift+H opens Find alone.                                                                                                                                                                                                                                                                                                                                                           |

- **Locks hold for everyone**: a match in a locked tab, on a locked page (an article with a locked
  page included) or layer, or in a locked element, is a held match for every role ("This text is
  locked").
- The server keeps the rule as it does for any edit: a Participant's Replace All reaches the room as
  its writing and its element text changes, which the room applies through the participant rule.

## The bar

- **Where**: a card at the top right of the canvas, under the Toolbar strip, over the pages
  (`TOOLBAR_CARD`'s surface). On a phone, a bar across the top of the canvas under the strip, the
  full width less 8 px a side; the Replace row wraps under it.
- **Find row**, left to right: the chevron (Show Replace / Hide Replace, `aria-expanded`), the Find
  field (placeholder "Find", the count inside its end), **Match Case** (`Aa`) and **Whole Word**
  (`ab` underlined) as toggles (`aria-pressed`), a hairline, **Previous Match** and **Next Match**,
  and **Close Find**. Every control has a tooltip naming it and its key.
- **Replace row**: the Replace With field (placeholder "Replace With"), then **Replace** and
  **Replace All** (the primary button), and below them, only when there are held matches, one muted
  line: "4 can't be replaced: text you can't edit, or locked".
- **States**: the field's count turns rose with "No Results"; Previous, Next, Replace and Replace All
  are disabled with no matches; Replace All with no replaceable match is disabled with its tooltip
  saying why. Hover, focus (the brand ring), pressed and disabled states as every toolbar control;
  dark mode in the card's dark surface.
- **Keyboard**: Tab moves through the bar's controls in the order above; Enter and Shift+Enter step
  from the Find field; Enter in Replace With replaces; Cmd/Ctrl+Enter in Replace With replaces all;
  Alt+C and Alt+W toggle Match Case and Whole Word; Escape closes. A control that turns off under the keyboard
  (Replace All taking the last match, Replace the only one) hands the keyboard back to the Find field, so Escape
  still closes the bar.
- **Screen readers**: the bar is a `search` landmark named "Find in Tab"; the count is a polite live
  region ("3 of 12", "No Results").
- **Touch**: every control is a 44 px target on a touch screen.

## Performance

- The searched text of the tab is gathered once per change of the tab, in one walk over its
  articles' blocks and its elements; a search is one left-to-right scan of each searched text
  (linear in the text, whatever the query), never a regular expression built from the query.
- The search runs 150 ms after typing stops (`FIND_DEBOUNCE_MS`), never per keystroke, and only
  while the bar is open; a closed bar costs nothing.
- Highlights in the writing are decorations mapped through each edit, rebuilt only when the matches
  change; element rings are drawn for the elements holding matches alone.
- Budget, measured: a 100-page article (`MAX_PAGES`, 3,000 paragraphs and 1,000 elements, about
  300,000 characters) is gathered and searched in about 40 ms the first time and under 15 ms per
  search after (the gathered text is kept while the tab is unchanged), and Replace All over its
  4,000 matches takes about 15 ms; a worst-case query (499 of one letter then another, against
  200,000 of that letter) stays linear.

## Telemetry

- `UI · Opened · FindBar` when the bar opens (by key or command).
- `UI · Used · FindReplace` for a Replace, `UI · Used · FindReplaceAll` for a Replace All.
- Never the query, the replacement or any text.

## Non-goals

- Patterns (regular expressions), wildcards and replacing with a captured group.
- Searching other tabs, other documents, notes, comments or alt text.
- Find in a deck while it presents.
