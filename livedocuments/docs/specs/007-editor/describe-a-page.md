# Describe a Page

An Editor says in words what the next page should hold (its title and some of what it says) and AI makes it: a new
page of the tab's kind, right after the page here, on the layout that suits the words best, with the words written
into it. Work Tracker 1503 (owner, 2026-11-27): "an AI button next to the Add slide/page button, to the left of the
cog... must work in every livedocuments mode, not just slide decks". Its blueprint is
[blueprints/describe-a-page.md](./blueprints/describe-a-page.md).

## Every kind

The page is always of the tab's kind ("One kind a tab", [pages-mode.md](./pages-mode.md#one-kind-a-tab)), named for
it everywhere the feature shows:

| Tab of       | Named               | What AI makes                                                                 |
| ------------ | ------------------- | ----------------------------------------------------------------------------- |
| Slides       | Describe a Slide    | A slide on one of the slide layouts, its text slots written                   |
| Infographics | Describe a Page     | An infographic page on one of the page layouts, its text slots written        |
| Articles     | Describe an Article | A new article: a title, headings, paragraphs and lists, flowed onto its pages |
| Flashcards   | Describe a Card     | A new card: its text, written to be spoken from (a card holds text only)      |

- **A real layout, really filled.** A slide or an infographic page is laid out from the same catalogue the page
  panel's Layouts offer, and its words go in through the same slots an agent's `change_pages` fills
  ([pages-for-agents.md](../024-agents/pages-for-agents.md) "Text slots"): the headline, the line under it, the
  bullets, the body texts, the figures (a stat's "73%"), a table's rows and a compound element's parts (a process's
  steps, a stat row's values). A slot the content does not need is taken off the page, never left holding the
  layout's sample or a stand-in ("N/A"): its text, its bullet dot, its stat in a stat row, and the card it sat in
  once that card holds no other words (with the icon inside it). Four figures on a layout of six leave four. A
  picture frame starts empty, as the panel's does.
- **Never a placeholder.** Words that only hold a place ("[Insert number here]", "N/A", "TBD", "Lorem ipsum", "XX%")
  are never laid on a page or written into an article: a reply with any is asked for once more, told so, and the
  better of the two replies is kept with its placeholders' slots (or lines) dropped. Where the person asks for
  examples or figures without giving them, AI writes fitting, plausible ones, never presented as facts about a real
  person, company or event.
- **Named by its heading.** A laid-out page is named in Contents by the words AI wrote for its heading, not by
  whichever text is largest (a card's big figure).
- **AI picks the layout.** First from the whole catalogue of the kind (each layout's name, its description and its
  slots), preferring a layout whose lists hold as many items as the request gives (four figures, five steps), then
  it writes the words for that one layout, seeing each slot's role and sample so it knows what goes where. A slot's
  role is told by its place, not its name: the page's heading and the line under it, a card's big text or its
  smaller line, a stat's figure or caption, a step, a text at a part of the page. The page's title goes in the
  heading whatever that slot is called (on a facts grid the largest words are a card's). It never invents a layout
  and never writes outside a slot.
- **Cards written whole.** A number and the words that say what it is are one card, asked for and written as one
  (`{figure, caption}`; a KPI's `{label, value, delta}`), never as a list of every number then a list of every
  caption, so a caption always sits under its own number. A card is a figure with its lines in the plain box they
  share, a stat of a stat row, or a big free figure with the lines set under it in its column; a box of words, or one
  holding a list of numbered items, is no card. AI writes only the cards the content needs: a card with an empty half
  (a number with no caption, or a caption with no number) is dropped whole, and so is a card showing a number another
  card already shows, which also asks AI once more (as a placeholder does). On a layout of two stat rows the cards
  written are spread evenly (four stats are two and two, not three and one).
- **Charts and changes only for trends.** A layout with a chart, or whose cards each carry a change ("+18%" against
  last quarter, a KPI Dashboard), is offered to AI only when the request gives a trend: a change or a comparison
  with before ("grew", "vs last year", "+18%"), figures for two or more periods (Q2 and Q3, March and April, 2025 and
  2026), or a chart asked for. Otherwise it would keep its sample chart and invent changes; four plain figures land
  on a figures layout instead.
- **Figures, not numbered parts.** A layout of numbered parts (an agenda's "01", "02", steps, objectives) is marked
  "not for figures" in the list AI chooses from, and is left out of it when the request gives figures (two or more
  numbers, one of them more than a small count or with a unit: "12k", "94%", "1.4M"; a time or a year is no figure).
  A part's number slot never takes a figure longer than it holds ("1.4M" in an "01"): that card, or that slot, is
  dropped. A figures layout with more cards than figures is preferred over one sized to the count.
- **Never an invented caption.** Where the request gives its own figures, AI writes those, each with the words the
  request gives for it, and adds no caption, label or figure the request did not give or ask for.
- **An article or a card** is written as `write_article` writes one ([pages-for-agents.md](../024-agents/pages-for-agents.md)
  "write_article"): Markdown read into the writing, the editor flowing it onto as many pages as it takes; a card
  keeps its text only.

## The button

- **Where**: in Contents' foot, between Add Page (Add Slide, Add Card, ...) and Contents Options (the cog), in the
  docked sidebar; in the Contents popover and the phone's sheet, which have no cog, at Add Page's right. A square
  button the height of Add Page, the sparkle glyph, the pointer cursor, the shared hover, focus and pressed looks;
  its tooltip names it ("Describe a Slide") with "AI makes it from your words" under it.
- **Who**: an Editor who is signed in, on a tab that is not locked: the button shows wherever Add Page does and the
  person has an account. A Participant and a Viewer see neither. A guest Editor sees no button: the AI features are
  for signed-in people ([ai-keys.md](../../../../liveworkspace/docs/specs/003-accounts/ai-keys.md)).
- **At the page limit** (100) it is disabled, as Add Page is, its tooltip naming the limit.

## The dialog

A centred modal (a bottom sheet on a phone) of one fixed height, room kept under the box for the longest thing it
says (a two-line refusal, or the slow line) so it never grows or moves, in the Describe with AI family (Describe a Rule,
Describe a Plan): the illustrated header (its own art: the person's words in a speech bubble with the sparkle,
turning by a dashed arrow into a slide with a headline and lines of text), the title ("Describe a Slide"), and the
line "Say what it is about and what it should say. AI picks a layout and writes it in."

- **Try an Example** above the box: three examples of the kind, each filling the box and putting the cursor in it.
- **The box**: up to 500 characters, its count under it, Ctrl or ⌘ Enter to make it.
- **The source line** (the shared `AiSource`, [ai-keys.md](../../../../liveworkspace/docs/specs/003-accounts/ai-keys.md)
  "The source line"): which AI makes it, with the way to add or change a key. On built-in AI its second line says
  the allowance: "Counts toward your 30 built-in AI questions a day." (Ask AI's day, the one count).
- **Make Slide** (Make Page, Make Article, Make Card), with the sparkle; Cancel beside it.
- **While it makes**: the box is read-only, the button busy ("Making…"). After eight seconds a quiet line under the
  box says "Still working. A model that thinks first can take up to a minute." Cancel stops the request (nothing is
  made, and the model's work stops with it); closing the dialog is a Cancel.
- **When it is made**: the dialog closes, the new page lands right after the page here (as Add Page's does, "Where a
  new page goes"), carrying the last page's size and background, glides into view and Contents marks it here. On a
  phone, Contents' sheet (which covered the canvas) closes, so the new page is in view. A
  toast says what was made ("Added a slide from the Agenda layout"). It is one edit: one undo takes the page away.
- **When it cannot**: the dialog stays open with the words kept, and says why under the box in fixed words, never the
  model's: not about a page ("That doesn't describe a slide. Say what it should be about."), a reply that could not
  be read, today's built-in AI used, a key that failed (said on the source line with Fix Key), the month's AI credits
  used (with Pro on), the server's AI not set up, or the connection.
- **The page limit or a lock reached meanwhile** (a peer's edit while it made): nothing is added, and the dialog says
  so.

## Which AI makes it

Ask AI's rules ([ask.md](../../../../liveworkspace/docs/specs/020-ask/ask.md) "Which AI answers"): the item's team's key
or the person's own when one applies, else built-in AI. On built-in AI a page is one of the day's built-in questions
(Ask's count, `ASK_BUILT_IN_PER_PERSON_PER_DAY`), however many times the model is asked for it (two asks for a
laid-out page, one for a written one, and one more when a reply held placeholders or showed one number on two cards), and with Pro on it
costs **1 AI credit** (`AI_CREDIT_COSTS.pageDraft`), spent only once the page's words are in hand, so a failure, a
refusal or a cancel costs nothing ([subscription.md](../../../../liveworkspace/docs/specs/019-subscription/subscription.md)
"What an AI operation costs"). A key spends neither.

## Privacy

Only the person's words and the catalogue's own names, descriptions and samples go to the model: nothing of the
document. Nothing logs the words or the reply; the log says the kind, the layout picked, how many asks it took and
how long.

## Telemetry

`UI · Opened · DescribePage` when the dialog opens; `Tab · Changed · PageDescribed` when a page is made (in place of
Add Page's own `PageAddedLikeLast`, which it does not send). Neither carries the words, the kind's catalogue or the
layout.
