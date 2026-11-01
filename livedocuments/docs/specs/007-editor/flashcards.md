# Flashcards

A **flashcard** is the fourth kind of page ([Pages](pages-mode.md) "Page kinds"): a small card of
text to speak from. Someone preparing a speech or a talk writes one card for each part of it, a
title and a couple of paragraphs, then flips through the cards as they speak. A tab of flashcards is
a **stack**: the editor shows the card in front, the cards still to come stacked behind it, and
moving between them turns the cards over like a flip-book.

A card holds **text only**. Its writing is an article's writing ([Article pages](article-pages.md)),
the same blocks, typing, formatting and collaboration, cut down to the text: nothing else is
inserted, dropped, pasted or drawn onto a card, and a card's writing never flows onto another card.

## Domain language

| Term              | Means                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **flashcard**     | A page of kind `flashcard` (`Page.kind`), in the **Flashcard (5:3)** size. "Card" for short in the interface.                |
| **stack**         | A tab of flashcards, every page of it a card ("One kind a tab").                                                             |
| **card in front** | The card the canvas shows, the one someone is on. Every other card is out of sight, behind it or already flipped.            |
| **flip**          | Moving from one card to another: the front card turns over the top out of view (forward), or comes back down onto the stack. |
| **speaking time** | How long the words on a card take to say aloud, shown in the card's footer.                                                  |
| **too long**      | A card whose writing runs past its foot. The text is kept, cut off at the foot, and the card says so.                        |

The interface says **Flashcards** for the kind and the tab ("Blank Flashcards"), **card** for one of them
("Duplicate card", "Card 3 of 10"), and never calls a card an article or a slide.

## A card

- **Size**: every card is **900 x 540** (`card`, a 5:3 index card at screen size), landscape only, labelled
  **Flashcard (5:3)**. It offers no other size and no orientation: its panel's Page tab shows the one size tile, so
  the card's shape is said but never changed.
- **Its writing is its own**: each card is a one-page article of its own (`Page.flow`, its writing in
  `Tab.articles[flow]`), never shared with another card. Two cards never share a flow; a stored card whose flow another
  card already holds is read with its own id as its flow.
- **A new card's writing**: an empty **Title** and an empty paragraph, in the Clean look with **Narrow** margins
  (48 px, the top never under 72 px), so a card's text area is 804 x 420 px: a title and about fifteen lines of body
  text, a couple of paragraphs. The empty paragraph's placeholder reads "Write what to say, or press / for headings and
  lists".
- **Background**: a card starts on the plain paper and carries the card before it's background, as every new page
  does ([Pages](pages-mode.md) "A new page's background"). The **Background** button sits beside the cog, with
  **Style** and **Text** ([Article pages](article-pages.md) "Article style"), whose **Page Numbers** row is not offered:
  a card always shows its place.
- **Title bar**: the label above the card reads its name, then "Flashcard (5:3)" ("Opening · Flashcard (5:3)"); its
  cog, lock, Style, Text and Background as on an article page.

## Text only

A card is a title and rich text, from the page toolbar: headings, bold, italic, underline, colour, links, lists and
alignment. Nothing else can be put on it.

- **The palette's kind is Flashcard** ([Pages](pages-mode.md) "The palette's kind"): on a card the Toolbar strip holds
  the page toolbar, docked, as on an article page, and nothing else: no category bar, no tiles, no **Search** (whose
  tiles would place elements). Moving onto a card turns the strip to it as any kind does.
- **The page toolbar** on a card has no **Insert** menu, no **Comment** and no **Assign Action** (a margin note is an
  element in the card's margin), and **More Formatting**'s last entry reads **Card style** (sentence case, as its neighbours).
- **The slash menu** offers the text blocks only: **Text**, **Title**, **Subtitle**, **Heading 1** to **3**,
  **Bulleted list**, **Numbered list**, **To-do list**, **Quote**, **Code** and **Divider**. Never a page break, an
  image, a table, a chart, a drawing, a callout or a sticky note.
- **Paste** keeps the text (headings, lists, quotes, code, links and the inline marks, as in an article); a pasted
  picture and pasted canvas elements are dropped, and the paste says so once ("Flashcards hold text only.").
- **Nothing lands on a card**: an element drawn, dropped, pasted or placed so its centre lands on a card is not added,
  and one moved onto it goes back, with a short notice, "Flashcards hold text only.", shown at most once every few
  seconds (as a locked page's is). An element already on a card (made before this rule, or by an agent) stays where it
  is, drawn and movable off the card.
- **Agents** add text to a card only ([Pages for agents](../024-agents/pages-for-agents.md)): `change_pages` adds
  a card (kind `flashcard`, filling a stack's only card while it is empty) and refuses a layout on one;
  `write_article` writes a card's writing as it writes an article's, naming the card by flow id or title, `new: true`
  adding a card after the last, in the `card` size only, its page breaks and zones left out and a table written as
  a list; and a changeset that adds an element onto a card's area, or moves one onto it, is refused (`text_only`,
  [Edit operations](../024-agents/edit-operations.md)).

## Never flows

A card is one short piece of writing on its own. It never grows another card.

- **Too long for this card**: when the writing runs past the card's foot, what fits shows and the rest is cut off at
  the foot, kept in the writing (nothing is lost, it comes back as the writing above it shrinks). A marker sits at the
  card's foot, centred over the cut: **Too long for this card**, in the amber of a notice, for everyone who can see the
  card. For someone who may edit the card's pages (an Editor, the card unlocked) the marker carries a
  **Split Onto a New Card** button.
- **Split Onto a New Card** (the card's menu, its page panel's action row, while the card is too long; and the
  marker's button): the writing from the first block that does not fit whole moves onto a new card right after it,
  the same size and background, its blocks unchanged (new ids), led by a Title reading the card's title with
  " (continued)" when the card has a title with words in it. One edit, one undo; the view flips to the new card. Where
  the first block that does not fit is the card's first block after its title (one paragraph alone too long for a
  card), nothing is moved: the button is disabled, its tooltip "One paragraph fills this card: shorten it to split".
  At the page limit it is disabled with the limit in its tooltip.
- A card is laid out alone, so a card's writing never moves onto another card, and no card is ever added or removed
  for writing.

## The stack

The canvas shows one card at a time, the **card in front**, centred where any page is framed.

- **The cards behind**: the cards after the card in front stand behind it as a stack, each a sheet the card's size
  peeking out below the one before it, 10 px lower and 14 px narrower each side (`FLASHCARD_STACK_STEP_Y`,
  `FLASHCARD_STACK_INSET_X`), each in its own background's tone, a little dimmer the further back. Up to **6** show
  (`FLASHCARD_STACK_MAX`), so the more cards are still to come the deeper the stack; the last card has none behind it.
  The cards behind are a view: they take no presses and are never exported.
- **Cards before** the one in front have been flipped away and are not drawn.
- The canvas pans and zooms as ever, but only the card in front and its stack are drawn: there is no row to pan along.
- **The + to add a card** sits beside the card in front ("Add Another Card"), adding a card after the last as every
  kind does, and the view flips to it.

## Flipping

Every way of going to a page goes to a card by flipping, never by gliding the view along a row: the page navigator's
**Previous page** / **Next page**, the arrow keys, Contents (a press, or Enter), a card's label, a swipe or a pan let
go toward a neighbour, a new card, a duplicate, a split and a delete. The view stays where it is (the card in front
framed); the card changes.

- **Forward** (to a card later in the stack): the card in front lifts toward the reader and turns up over its top
  edge, as a cue card does, and fades as it goes, uncovering the card behind it, which is now in front. **420 ms**
  (`FLASHCARD_FLIP_MS`), ease in-out, in perspective.
- **Back** (to an earlier card): that card comes back over the top edge and settles onto the stack in front, over the
  card that was in front. The same 420 ms, mirrored.
- A flip to a card several places away is one flip, forward or back.
- A second flip while one is under way finishes the first at once and starts the next.
- **Reduced motion**: no flip; the card in front changes at once.
- The flip is drawn over the canvas, holding no presses; the new card in front is ready for the caret and presses at
  once.

## Card number and speaking time

Each card's footer, inside its bottom-right corner (in the margin, right-aligned to the text's right edge), reads
**Card 3 of 10**, then, when the card has words on it, a clock glyph and its speaking time: **45 sec** or **3 min**.

- **Speaking time**: the words on the card (its title and every block's text, a word being a run of letters or
  digits) at **130 words a minute** (`FLASHCARD_WORDS_PER_MINUTE`, a steady speaking pace), rounded up: under a minute
  to the next 5 seconds ("25 sec"), from a minute to the nearest whole minute ("1 min", "3 min"). An empty card shows
  its number alone.
- It counts the writing as written to the tab (each commit, [Article pages](article-pages.md) "Commits"), not each
  keystroke.
- Small muted type in the card's body font, in the card's ink (dark on a light card, light on a dark one), as an
  article's page number is. A view, never an element: exports leave it out.
- **Contents** says each card's speaking time in its row's line ("Flashcard · Opening · 1 min").

## Contents

Contents lists every card in order, as it lists any page ([Pages](pages-mode.md) "Contents"): its number, its live
picture (the card as it is, its writing included) and its name. A press flips to it. The **Add Page** footer reads
**Add Another Card**. Reordering a row moves the card in the stack.

## Making flashcards

- **The first page's choice** offers **Flashcards** beside Infographic, Article and Slide, four cards two by two:
  "Cards to speak from: a title and a few lines each, flipped one at a time." Choosing it turns the page into the first
  card of a stack, the caret in its title.
- **Blank Flashcards** (template `blank-flashcards`): one empty card, its kind already chosen. On the Start screen's
  **Flashcards** group (led by it) and the landing page's Blank Slate, after Blank Infographic.
- **Templates**: three stacks written out, so the cards show what they are for:
  - **Conference Talk** (`talk-flashcards`): a 15-minute talk on six cards (Opening, The Problem, What We Tried, What
    Worked, What It Means for You, Close and Questions).
  - **Wedding Toast** (`wedding-toast`): a best-person's toast on five cards.
  - **Product Pitch** (`pitch-flashcards`): a two-minute pitch on five cards.

  They sit in the Presentations category, in the Start screen's Flashcards group and on the marketing site's Slides
  band.

## Share roles

([Share roles](../013-workspace/share-roles.md))

| Role            | With flashcards                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | Everything on this page: writes and formats, adds, duplicates, moves, splits and deletes cards, sets their style and background.                                                          |
| **Participant** | Writes the text of the cards already there, as in an article. Never adds, splits, moves or deletes a card, or sets its style; sees the Too long marker without its button. Flips through. |
| **Viewer**      | Reads and flips through the cards; changes nothing. Sees the Too long marker without its button.                                                                                          |

Flipping only moves the view, so it is everyone's.

## Telemetry

- `Tab · Changed · PageKindFlashcard` (the first page's choice), `FlashcardAdded` (a card added).
- `Tab · Changed · FlashcardSplit` (Split Onto a New Card, from the menu or the marker).
- `UI · Used · FlashcardFlip` once per flip that moved the card in front.
- Never text.

## Speaker note cards

A slide's speaker notes use a smaller form of flashcards: plain-text **note cards** on the deck's slide, with a
flashcard's speaking time, stack and flip but no page, title or editor of their own
([Speaker note cards](../012-collaboration/speaker-note-cards.md)).

## Non-goals

- Presenting a stack full screen with a timer (the editor's own view is the speaking view).
- Pictures, charts or anything but text on a card.
- Printing several cards to a sheet.
