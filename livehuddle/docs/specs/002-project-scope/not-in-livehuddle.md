# Not in livehuddle

Status: **approved, being built** (Work Tracker #423, owner, 2026-11-04).

livehuddle is for meeting in Spaces ([Purpose](../001-project-vision/purpose.md)). Everything below came over from
livediagram at the fork and **leaves livehuddle**; livediagram keeps all of it, and its specs there are the ones to
read. A spec in this tree marked **Leaving livehuddle** describes code that is still here until the part named below
removes it: fix nothing in it but a bug that breaks a Space, and build nothing new on it.

## Why

The owner (2026-11-04): livehuddle carried the whole of Workshop mode, but livehuddle isn't about retros and
workshops; it is all about the meet aspect in Spaces. A facilitator running a retro has livediagram's Workshop mode,
which has every one of these tools, so nothing is lost to anyone: each tool now has one home.

## What leaves

| What                                                                                                                                                                                                                                                                                                                                                                   | Its specs in this tree (until removed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Removed in                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Slide decks, building a deck, presenting, the Page element                                                                                                                                                                                                                                                                                                             | [Presentation mode](../012-collaboration/presentation-mode.md), [The Page element](../009-elements/page-element.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Part 2 (done)                                                                         |
| The retrospective, workshop, planning and strategy templates, and the quizzes and games                                                                                                                                                                                                                                                                                | [Templates by mode](../007-editor/templates-by-mode.md) (rewritten), [Quiz and game templates](../012-collaboration/quiz-and-game-templates.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Part 3 (done)                                                                         |
| Every Collaborate element: Dot vote, Poll, Quiz, the estimate scales, Temperature check, Idea box, Q&A board; Timer, Stopwatch, Reveal zone, Done check, Picker; Comment panel, Action card, Agenda, Decision record, Roll call                                                                                                                                        | [Live poll](../012-collaboration/live-poll.md), [Keeping a poll's results](../012-collaboration/poll-result-capture.md), [Vote integrity](../012-collaboration/vote-integrity.md), [Quiz](../012-collaboration/quiz.md), [Estimate card](../012-collaboration/estimate-card.md), [Temperature check](../012-collaboration/temperature-check.md), [Idea box](../012-collaboration/idea-box.md), [Q&A board](../012-collaboration/qa-board.md), [Per-participant responses](../012-collaboration/participant-responses.md), [Done check](../012-collaboration/done-check.md), [Picker](../012-collaboration/picker.md), [Reveal zone](../009-elements/reveal-zone.md), [The Comment Panel](../012-collaboration/comment-pin.md), [The Action Panel](../012-collaboration/action-panel.md), [Agenda](../012-collaboration/agenda.md), [Decision record](../012-collaboration/decision-record.md), [Roll call](../012-collaboration/roll-call.md) | Part 3 (done); code: part 4 (done)                                                    |
| The Session strip's Poll, the Session button, the Workshop tour                                                                                                                                                                                                                                                                                                        | [Session button](../012-collaboration/session-button.md), [Workshop tour](../012-collaboration/workshop-tour.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Part 3 (done); code: part 4 (done)                                                    |
| The diagram tools: the Shapes and My shapes categories, arrows and lines, the Draw tools (pencil, highlighter), the Layout containers but the frame (lane, stack, boundary, timeline, diagram key, card, badge, step number), pointer notes, tables and checklists, the Data charts and progress and rating, code blocks, the components, the video and website embeds | [The lane](../009-elements/lane.md), [The stack](../009-elements/stack.md), [The boundary](../009-elements/boundary.md), [Timeline](../009-elements/timeline.md), [The diagram key](../009-elements/diagram-key.md), [The card](../009-elements/card.md), [The badge](../009-elements/badge.md), [The step number](../009-elements/step-number.md), [The pointer note](../009-elements/pointer-note.md), [Checklist](../009-elements/checklist.md), [Data charts](../009-elements/pie-chart.md), [Progress](../009-elements/progress.md), [Rating](../009-elements/rating.md), [Code block](../009-elements/code-block.md), [Web components](../009-elements/web-components-and-no-groups.md), [YouTube video](../009-elements/youtube-video.md), [More than YouTube](../009-elements/embed-providers.md), [Website embed](../009-elements/website-embed.md), and the arrow, shape and pen specs in `008-canvas/`                             | Part 3 (offered nowhere, done); their UI leftovers: part 4 (done); element code: #459 |

Each leaving spec has its twin in livediagram under the same path (`livediagram/docs/specs/`), which stays the one
to change.

## What stays

- **Spaces, avatars, rooms and calls**: Avatar mode, the Navigate elements, the office pieces, the Selection Mode
  buttons, the four Spaces templates, proximity audio and calls.
- **Light meeting tools**: the Session strip's **Timer** and **Vote** (the quick vote: dots on the notes in a room),
  [Bring Focus](../012-collaboration/bring-focus.md), and the [facilitator baton](../012-collaboration/facilitator.md)
  they answer to. Follow-me, the laser and the spotlight. The five **Reaction Pads** (Confetti, Sparkles, Hearts,
  Applause, Fireworks: press one or walk onto it, [Reaction Pad](../009-elements/reaction-pad.md)) stay too (owner,
  2026-11-04), in the meeting palette's React category.
- **Light content**: sticky notes, text, images (with image search and the gallery), stickers, icons, link cards and
  frames.
- **Talking without a call**: speech bubbles, comments with mentions, comment reactions, and assigned actions from
  any element's menu with the Collaborate Panel.
- **Every platform feature** ([v1 scope](v1-scope.md) section 7).

## A Space that already holds a leaving element

A stored Space may already hold a retro board, a poll card or a Page.

- **Part 2 is done**: no route, menu, palette entry, command, shortcut or help article offers a deck, presenting or
  the Page. A document's stored deck (its `presentation` field) is kept: the editor never reads or writes it, so a
  save leaves it as it was, and livediagram still presents it. A stored Page is a shape kind like any other: it still
  draws, moves, copies, edits and deletes.
- **Part 3 is done**: no palette entry, Search result, template, shortcut or help article adds a leaving element,
  and the Session strip offers Timer and Vote. A stored one still draws, moves, copies and deletes as it did, and a
  running poll or vote ends as it did: the strip's Poll button shows while a stored Poll card's poll runs, so the
  person who started it can end it, and never offers a new one. The retired templates' builders and previews were
  deleted with them (the catalogue, the union and the builders move together); a document named after one still
  reads as unnamed.
- **Part 4 is done**: livehuddle's code for the Collaborate elements, the Session button, the live poll, the Q&A
  board's endpoint and the per-participant responses is deleted (see [Retired elements](#retired-elements) below). The
  count it started with, read only: no stored livehuddle tab on the build machine or in the checked-in fixtures holds
  a leaving kind (no local store holds any livehuddle tab, and no fixture names one of the kinds). Production tabs live
  in each document's Durable Object, which no read-only query reaches, so the placeholder is what keeps them safe.

### Retired elements

A **retired element** is a stored element whose kind livehuddle no longer has: the 14 shape kinds part 4 deleted
(`session-button`, `reveal`, `picker`, `comment-pin`, `action-card`, `done-check`, `estimate`, `temperature`,
`idea-box`, `qa-board`, `agenda`, `decision`, `roll-call`, `quiz`), and any other shape kind livehuddle does not know.

- **Kept untouched.** Its kind and every field it carries (a poll's question, a board's notes, its responses) stay in
  the document exactly as stored. Nothing in livehuddle reads or writes them, so a save, a sync, a copy and an undo
  carry them through; livediagram still opens them as they were.
- **Drawn as a placeholder.** A plain card in the element's own box: a dashed outline, a muted fill, the kind's name
  ("Q&A Board", "Poll", "Agenda"; "Unknown Element" for a kind livehuddle never had) and, beneath it, "Not in
  livehuddle". Its stored label shows below that when it has one. The export and the thumbnail draw the same card.
- **What it does.** It selects, moves, resizes, copies, locks, layers and deletes like any element, and takes
  comments. It takes no typed label (double-clicking it opens nothing), has no settings or context-menu section of its
  own, presses nothing and starts nothing. Agents read it by its stored kind.
- **Nothing new.** No palette entry, Search result, template, agent verb, CLI command or paste makes one; an agent that
  names a retired kind gets a square (the shape coercion every unknown kind gets).

The session state that only these elements used goes the same way: a stored running poll is never shown, and the
Session strip offers Timer and Vote only. A document's stored deck (`presentation`) stays as part 2 left it: carried
and redacted by the api, never read or written by the editor.

### The diagram tools still in livehuddle's UI

Part 4 also removes the diagram tools livehuddle's UI still offered after part 3, with their help articles (each old
address redirects to the nearest article that stays): Tidy Up's Auto Layout tiles (Tidy Up keeps Auto-Align and its
cleanup), the Explorer's Shape Libraries page and library import, the draw.io, Mermaid, Markdown and Microsoft
Whiteboard imports, and Settings' Auto-Attach Arrows. The element engine under the diagram tools (shapes, arrows,
pens, the layout containers) is Work Tracker #459's, not this part's: a stored one still draws, moves and deletes.

## Share roles

Nothing changes in who may do what with what stays ([Share roles](../013-workspace/share-roles.md)). A leaving
element's role rules no longer apply: its placeholder follows the Editor, Participant and Viewer rules of any element
(an Editor moves, copies and deletes it; a Participant moves and deletes only what they added, as with any element, and
comments on it; a Viewer sees it).

## Testing

- Part 2: no route, menu, palette entry or help article offers a deck, presenting or the Page: `EditorHeader.test.tsx`
  (no Present button), `editor-commands.test.ts` (no Slide Deck command), `settings-catalogue.test.ts` (no Presenting
  settings), `palette-search.test.ts` (no Page result) and `view-transitions.test.ts` (no slide moves); the router's
  `legacy-editor-route.test.ts` pins the help redirects.
- Part 3: the catalogue test pins the five templates; a link, an agent or a seed naming a leaving template is answered
  with Blank Space (`retired-templates.test.ts`); a palette test pins the meeting palette; the strip test pins Timer
  and Vote.
- Part 4: a stored tab holding each deleted kind loads, saves unchanged and shows its placeholder
  (`retired-kinds.test.ts` in `packages/document`, `RetiredElementFace.test.tsx` and the e2e
  `retired-elements.spec.ts` in the editor); the export draws the placeholder (`svg-render-retired.test.ts`); no
  palette entry, Search result or agent schema names a deleted kind; Tidy Up, Import and Settings show no diagram
  tool; the router's `legacy-editor-route.test.ts` pins the retired help addresses.
- Every part: the help path tests (`repo-paths-in-docs`, `article-links`, the heading anchors) pass.
