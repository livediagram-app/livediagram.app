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

| What                                                                                                                                                                                                                                                                                                                                                                   | Its specs in this tree (until removed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Removed in                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Slide decks, building a deck, presenting, the Page element                                                                                                                                                                                                                                                                                                             | [Presentation mode](../012-collaboration/presentation-mode.md), [The Page element](../009-elements/page-element.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Part 2 (done)                              |
| The retrospective, workshop, planning and strategy templates, and the quizzes and games                                                                                                                                                                                                                                                                                | [Templates by mode](../007-editor/templates-by-mode.md) (rewritten), [Quiz and game templates](../012-collaboration/quiz-and-game-templates.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Part 3                                     |
| Every Collaborate element: Dot vote, Poll, Quiz, the estimate scales, Temperature check, Idea box, Q&A board; Timer, Stopwatch, Reveal zone, Done check, Picker; Comment panel, Action card, Agenda, Decision record, Roll call                                                                                                                                        | [Live poll](../012-collaboration/live-poll.md), [Keeping a poll's results](../012-collaboration/poll-result-capture.md), [Vote integrity](../012-collaboration/vote-integrity.md), [Quiz](../012-collaboration/quiz.md), [Estimate card](../012-collaboration/estimate-card.md), [Temperature check](../012-collaboration/temperature-check.md), [Idea box](../012-collaboration/idea-box.md), [Q&A board](../012-collaboration/qa-board.md), [Per-participant responses](../012-collaboration/participant-responses.md), [Done check](../012-collaboration/done-check.md), [Picker](../012-collaboration/picker.md), [Reveal zone](../009-elements/reveal-zone.md), [The Comment Panel](../012-collaboration/comment-pin.md), [The Action Panel](../012-collaboration/action-panel.md), [Agenda](../012-collaboration/agenda.md), [Decision record](../012-collaboration/decision-record.md), [Roll call](../012-collaboration/roll-call.md) | Parts 3, 4                                 |
| The Session strip's Poll, the Session button, the Workshop tour                                                                                                                                                                                                                                                                                                        | [Session button](../012-collaboration/session-button.md), [Workshop tour](../012-collaboration/workshop-tour.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Parts 3, 4                                 |
| The diagram tools: the Shapes and My shapes categories, arrows and lines, the Draw tools (pencil, highlighter), the Layout containers but the frame (lane, stack, boundary, timeline, diagram key, card, badge, step number), pointer notes, tables and checklists, the Data charts and progress and rating, code blocks, the components, the video and website embeds | [The lane](../009-elements/lane.md), [The stack](../009-elements/stack.md), [The boundary](../009-elements/boundary.md), [Timeline](../009-elements/timeline.md), [The diagram key](../009-elements/diagram-key.md), [The card](../009-elements/card.md), [The badge](../009-elements/badge.md), [The step number](../009-elements/step-number.md), [The pointer note](../009-elements/pointer-note.md), [Checklist](../009-elements/checklist.md), [Data charts](../009-elements/pie-chart.md), [Progress](../009-elements/progress.md), [Rating](../009-elements/rating.md), [Code block](../009-elements/code-block.md), [Web components](../009-elements/web-components-and-no-groups.md), [YouTube video](../009-elements/youtube-video.md), [More than YouTube](../009-elements/embed-providers.md), [Website embed](../009-elements/website-embed.md), and the arrow, shape and pen specs in `008-canvas/`                             | Part 3 (offered nowhere); code: Follow-ups |

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
- **Part 3** removes only the ways to add one. A stored one still draws, moves, copies and deletes as it did, and
  a running poll or vote ends as it did.
- **Part 4**, which deletes the Collaborate code, first counts the stored tabs holding a leaving kind (read only). A
  leaving kind it deletes is read as an unknown element: kept in the document untouched, drawn as a plain labelled
  placeholder an Editor can delete, never silently dropped, so nothing anyone wrote is lost on a save.

## Share roles

Nothing changes in who may do what with what stays ([Share roles](../013-workspace/share-roles.md)). A leaving
element's role rules apply to a stored one until part 4; after it, its placeholder follows the Editor, Participant
and Viewer rules of any element (an Editor moves and deletes it; a Participant and a Viewer see it).

## Testing

- Part 2: no route, menu, palette entry or help article offers a deck, presenting or the Page: `EditorHeader.test.tsx`
  (no Present button), `editor-commands.test.ts` (no Slide Deck command), `settings-catalogue.test.ts` (no Presenting
  settings), `palette-search.test.ts` (no Page result) and `view-transitions.test.ts` (no slide moves); the router's
  `legacy-editor-route.test.ts` pins the help redirects.
- Part 3: the catalogue test pins the five templates; a link, an agent or a seed naming a leaving template is answered
  with Blank Space (`retired-templates.test.ts`); a palette test pins the meeting palette; the strip test pins Timer
  and Vote.
- Part 4: a stored tab holding each deleted kind loads, saves unchanged and shows its placeholder.
- Every part: the help path tests (`repo-paths-in-docs`, `article-links`, the heading anchors) pass.
