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
- **Title bar**: the label above the card reads its name, then "Flashcard (5:3)" ("Opening · Flashcard (5:3)"): its
  own name, else its title, so writing a card's title names it ([Pages](pages-mode.md) "Page names"); its
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
  table (HTML, or tab-separated text) comes as a list, a row an item with its cells joined by " · ", as an agent's
  does; a pasted picture, page break and canvas elements are dropped, and the paste says so once ("Flashcards hold
  text only.").
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

The canvas shows one card at a time, the **card in front**, centred where any page is framed. The stack is shared:
any tab but an article's can be switched between stacked and side by side (a tab of infographic pages stacked stands
the same way; only flashcards stack by default) ([Pages mode](pages-mode.md) "Stacked infographics", "Stacked or side by side"); a tab of cards switched to
side by side shows its cards in a row, as slides stand, with no fan, footer nav or flip.

- **The cards behind**: the cards after the card in front stand behind it **fanned out**, like a hand of cards
  set down: each a full sheet the card's size, turned about its centre and nudged off it, alternating left and right
  and turning a little further the deeper it sits (`FLASHCARD_FAN`: 2 degrees for the nearest, up to 5 for the
  furthest, nudged at most 13 px), so their corners show all round the card, not only below it. They **recede, never
  compete**: each is in its own background's tone but see-through, the nearest at 50% opacity and each further back
  6% fainter (never below 20%), each drawn with a fine edge (a 1 px line, dark on a light canvas and light on a dark
  one) and a soft shadow, so a white card behind a white card still shows on a light canvas, and the card in front is the one thing at full strength. Up to **6** show (`FLASHCARD_STACK_MAX`), so the more
  cards are still to come the fuller the fan; the last card has none behind it. The fan is set by depth, never by
  chance, so it looks the same every time; on a flip each card eases to its new place in the fan (200 ms,
  ease-out; at once under reduced motion): only its offset, tilt and fade ease. The stack stands where the card
  in front does and moves with the view, so the cards behind never slide across from the page the view left: on a
  flip only the card coming to the front, and the one joining the back, change. The cards behind are a view: they take no presses and are never
  exported. The presenter's note cards keep their own small straight stack.
- **The card in front stands out**: however strong the backgrounds (a dark or busy card over cards of the same tone),
  its edge reads: it casts a soft shadow onto the fan and wears a thin rim just outside its edge (1.5 canvas px,
  light on a dark card, faint slate on a light one), both drawn under the card so they never cover it, and only while
  cards stand behind it. A view like the fan: no presses, never exported.
- **Cards before** the one in front have been flipped away and are not drawn.
- The canvas pans and zooms as ever, but only the card in front and its stack are drawn: there is no row to pan along.
  So a wheel or a two-finger trackpad scroll pans **up and down only** on a stack: its sideways part (and a Shift
  wheel's) moves nothing, so a stray sideways scroll never slides the card off to an empty canvas; a Ctrl or Cmd wheel
  still zooms (`stacked`, `hooks/canvas/useCanvasPinchZoom.ts`). A finger's drag, the hand tool and a held Space still
  pan both ways, because letting go toward a neighbour turns to it (a swipe flips, "Flipping"): that is how a phone
  goes from card to card.
- **Long stacks stay quick**: only the writing of the card in front and the cards either side of it is open for
  writing at a time (and the card being written, while it is). The other cards are read from their text where they
  are shown away from the canvas: Contents' thumbnails and the Map draw their lines from it, an export sets their
  words as an export of a document that is not open does, and Find reaches their text and turns to their card. In
  the browser those words are measured in the faces the card is drawn in, and their lines break where the card's
  own writing breaks them (at spaces and after a hyphen inside a word, as Safari or Chrome fits a line), so an
  exported stack of 100 cards keeps every line break the screen shows; away from a browser (an agent's preview)
  they break at an average glyph's width, a few words off. A
  stack of 100 cards opens, types and flips on a mid-range phone as one of a few cards does. What settles after
  each typed change (the zones an article fits to its pictures and drawings) looks only at writing that has zones,
  which a card never has, so typing on a card does no work for the rest of the stack: no pause over 50 ms while
  typing on a throttled phone. A typed change renders the editor once, not again as it saves, and reads again only
  the card that changed, so its longest busy stretch stays under about 30 ms on a phone four times slower than a
  laptop.
- **The + to add a card** sits beside the card in front ("Add Card"), adding a card right after the card in front
  (pages-mode.md "Where a new page goes"), as Contents' Add Card does, and the view flips to it.

## Flipping

Every way of going to a page goes to a card by flipping, never by gliding the view along a row: the page navigator's
**Previous page** / **Next page**, the arrow keys, Contents (a press, or Enter), a card's label, a swipe or a pan let
go toward a neighbour, a new card, a duplicate, a split and a delete. The view stays where it is (the card in front
framed); the card changes.

- **Forward** (to a card later in the stack): the card in front lifts away, quietly: it tips back a little over its
  top edge (14 degrees, in perspective), rises a touch (3% of its height), shrinks a shade (to 98.5%) and fades out,
  uncovering the card behind it, which is now in front. **240 ms** (`FLASHCARD_FLIP_MS`), a quick ease-out (most of
  it over in the first half), so the next card reads at once. A flip happens again and again while someone talks: it
  should register at a glance and never pull the eye (it was a 78 degree, 420 ms turn before 2026-11-04, too much).
- **Back** (to an earlier card): the card that was in front sinks away toward the stack (tipped 10 degrees the other
  way, lowered 2%, shrinking a shade) and fades, uncovering the earlier card, now in front. The same 240 ms.
- **Only the card leaving moves**: the card now in front is the real card, drawn with its writing from the flip's
  first frame, never a picture standing in for it, so its words are there while the flip plays, not after it.
- A flip to a card several places away is one flip, forward or back.
- A second flip while one is under way finishes the first at once and starts the next.
- **The card in front taken away** (an undo of the split that made it, a peer's delete): the card before its place
  comes to the front (the first, when it was first), as a delete lands on the page before; never the stack's first card.
- **Reduced motion**: no flip; the card in front changes at once.
- The flip is drawn over the canvas, holding no presses; the new card in front is ready for the caret and presses at
  once.

## Getting around a stack

The card in front carries its own **Previous** and **Next**, in its footer at the bottom right: a chevron-left
button, its place (**Card 3 of 10**), a chevron-right button (`StackNav`, `components/canvas/FlashcardStack.tsx`).

- A press goes to the card before or after by a flip, exactly as Contents or the arrow keys do. **Previous** is
  disabled on the first card and **Next** on the last. Tooltips "Previous Card" and "Next Card"; spoken names
  "Previous card" and "Next card", the group named "Card 3 of 10". No First or Last: Contents goes anywhere in one
  press, and two more buttons would crowd the card's corner.
- For everyone who can see the pages, Viewers and Participants too: it only moves the view. On a phone too, its
  buttons 28 px with a 44 px touch reach (`touch-target-y`).
- In the card's ink, quiet until hovered. Drawn over the card's writing (whose paper would otherwise take the press:
  the footer is lifted within the canvas world, `z-[2]`), and a press on it is its own: no caret, no marquee, no
  deselect.
- Left out of exports and GIFs; not shown in zen (the card's place shows alone there) or while presenting.
- On a stack the bottom-right cluster's page navigator is not shown: the card's own Previous and Next replace it.
- Telemetry `UI · Used · StackNav`.

## Card number and speaking time

Each card's footer, inside its bottom-right corner (in the margin, right-aligned to the text's right edge), holds its
Previous, **Card 3 of 10** and Next ("Getting around a stack"), then, when the card has words on it, a clock glyph and its speaking time: **45 sec** or **3 min**.

- **Speaking time**: the words on the card (its title and every block's text, a word being a run of letters or
  digits) at **130 words a minute** (`FLASHCARD_WORDS_PER_MINUTE`, a steady speaking pace), rounded up: under a minute
  to the next 5 seconds ("25 sec"), from a minute to the nearest whole minute ("1 min", "3 min"). An empty card shows
  its number alone.
- It counts the writing as written to the tab (each commit, [Article pages](article-pages.md) "Commits"), not each
  keystroke.
- Small muted type in the card's body font, in the card's ink (dark on a light card, light on a dark one), as an
  article's page number is. Never an element: exports leave it out. Only its Previous and Next take presses.
- **Contents** says each card's speaking time in its row's line ("Flashcard · Opening · 1 min").

## Contents

Contents lists every card in order, as it lists any page ([Pages](pages-mode.md) "Contents"): its number, its live
picture (the card as it is, its writing included) and its name. A press flips to it. The **Add Page** footer reads
**Add Card**. Reordering a row moves the card in the stack.

## Making flashcards

- **The first page's choice** offers **Flashcards** beside Infographic, Article and Slide, four cards two by two:
  "Cards to speak from: a title and a few lines each, flipped one at a time." Choosing it turns the page into the first
  card of a stack, the caret in its title.
- **Blank Flashcards** (template `blank-flashcards`): one empty card, its kind already chosen. On the Start screen's
  **Blank Pages** group and the landing page's Blank Slate, after Blank Infographic.
- **Templates**: four stacks written out, so the cards show what they are for:
  - **Conference Talk** (`talk-flashcards`): a 15-minute talk on six cards (Opening, The Problem, What We Tried, What
    Worked, What It Means for You, Close and Questions).
  - **Wedding Toast** (`wedding-toast`): a best-person's toast on five cards.
  - **Product Pitch** (`pitch-flashcards`): a two-minute pitch on five cards.
  - **School Presentation** (`class-presentation`): a five-minute class talk on the water cycle, on five cards.

  Each sits in the catalogue category of what it is for ([Template categories](../008-canvas/canvas-and-palette.md#template-categories)):
  Conference Talk and Wedding Toast in Talks (the toast also in Events), Product Pitch in
  Pitches and School Presentation in Learning (both also in Talks). Blank Flashcards is in the Start screen's Blank Pages group.

  **Their previews tell apart at rest** (`packages/template-previews/src/template-preview-26.tsx`): each draws its stack
  as the editor shows it (the front card with its title, lines and "1 of n" footer, the cards to come peeking out below),
  with a mark of its own on a tinted badge in the front card's top right, drawn without a hover: a clock (Conference Talk,
  indigo), a heart (Wedding Toast, rose), a rising arrow (Product Pitch, emerald) and a raindrop (School Presentation,
  sky), so four stacks side by side in Talks never look alike. On hover the lines write themselves and the
  badge swells.

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
