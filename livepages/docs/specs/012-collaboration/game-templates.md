# Game templates

Four session templates for the lighter end of running a room: icebreakers and three party games.
They open in Workshop ([Workshop mode](workshop-mode.md#templates)) and live in their own catalogue
category, **Games** ([Template categories](../008-canvas/canvas-and-palette.md#template-categories)).

## Why

Workshop already had every piece a warm-up needs: the Picker
([Picker](picker.md)), the reveal zone ([Reveal zone](../009-elements/reveal-zone.md)), polls and timers on session
buttons ([Session button](session-button.md)) and reaction pads ([Reaction pad](../009-elements/reaction-pad.md)).
Nothing put them together, so the first person to run a team game had to assemble one from an empty tab. Every
other session format (retros, brainstorms, a meeting agenda) had a template; games had none, and a game shelved under
Workshops beside the retros is hard to find. They get a category of their own.

## The category

- **Games**, id `games`, "Icebreakers, bingo and party games for the room." (48 characters, in the
  category's 40 to 50 band). Search words: `icebreaker icebreakers warm up energiser fun team building`.
- Primary home of the four templates below. **Doodle Warm-Up** (`doodle-warmup`, primary Brainstorm) is
  cross-listed here: it is a drawn icebreaker game.
- In Start a Workshop ([Templates by mode](../007-editor/templates-by-mode.md#workshop-templates)) the five
  form their own group, **Games**, "Icebreakers and games to warm up the room.", after
  Meetings.
- **Icebreaker Questions** joins Workshop's Popular, after Crazy 8s.

## The templates

Every template opens on the dot grid (`grid`), in Workshop, with the session boards' heading (a title with a
sticker, a one-line how-to) and section labels (`template-session-parts.ts`). Every tool sits beside the words
that say when to press it, as the other session boards do.

### Icebreaker Questions (`icebreaker-questions`)

"Icebreakers · Team kick-off" with a waving-hand sticker; how-to: "Spin a question, spin a person, two minutes
each. Then add yourself to the wall."

- **How it works**, the left column: four tinted step cards joined by arrows: 1 Spin a
  question, 2 Spin a person, 3 Two minutes, 4 Say hello.
- **The spin**, the centre: a Picker over twelve written questions labelled "Today's question" (420 x 180), a
  Picker over the room labelled "Who answers?" (420 x 150), a 2-minute timer and a Hearts reaction pad, "Love
  that".
- **Say hello**, the right column: a note ("A sticky each: your name, where you are and one thing we would not
  guess.") over two example stickies in different colours.
- The twelve questions: What was your first job? · What is the best meal you have ever had? · Which skill would you
  love to learn? · What is on your desk that has a story? · What did you want to be as a child? · Where would you go
  with a free week? · What is a small thing that makes your day? · Which film could you watch again and again? ·
  What is the best advice you have been given? · Tea, coffee or neither? · What is a hobby you would recommend? ·
  What song always gets you dancing?

### Two Truths and a Lie (`two-truths-and-a-lie`)

"Two Truths and a Lie" with a thinking-face sticker; how-to: "Each player writes three things about themselves,
one of them false. The room votes on the lie, then the player owns up."

- **Three player rows**: an initials disc with the player's name, three numbered statement stickies (1, 2, 3, one
  colour per player), and a poll button ("Which one is the lie?", choice: 1, 2, 3) beside them.
- The first row is a worked example, Maya: "I have climbed Ben Nevis.", "I once sang on live radio.", "I have never
  eaten pizza."; the other two rows (Dev, Priya) hold "A truth, or the lie" stickies for the next players to write.
- **Kit**, the right column: a Picker over the room labelled "Who goes next?", a Confetti reaction pad, "Got
  me!", and a note on how it runs.

### Would You Rather (`would-you-rather`)

"Would You Rather?" with a dice sticker; how-to: "Press a question, everyone picks a side, then the room makes its
case."

- **Six dilemmas** in two columns of three: each an A card and a B card (two tints) with an "or" disc between them,
  and a poll button asking "Would you rather?" with the two sides as its answers (the
  question kept short so it reads on the button; the answers say what the choice is).
- **Kit** under them: a 1-minute timer note ("One minute for each side to make its case.") with its button, and an
  Applause reaction pad.

### Find Someone Who Bingo (`people-bingo`)

"Find Someone Who · Bingo" with a handshake sticker; how-to: "Find a teammate for each square and put a sticky
with their name on it. A full row, column or diagonal wins."

- **The card**: a 4 x 4 grid of square cells, each a "Find someone who…" prompt (has lived abroad, speaks three
  languages, can juggle, …), tinted in two alternating tones.
- **Kit**, the right column: a 10-minute timer, a Fireworks reaction pad, "Bingo!", an example name sticky, and a
  Winners checklist.

## Share roles

Following [Gate a feature by share role](../../instructions/gate-a-feature-by-share-role.md). The templates add no
new behaviour: each role does what the elements they are built from already allow.

| Role            | On a game board                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | Creates the board from the template; spins the Pickers; starts the polls and timers; edits every element                      |
| **Participant** | Answers polls; reacts; adds and writes stickies (statements, hellos, bingo names) |
| **Viewer**      | Watches every spin and poll; writes nothing, so cannot answer, react or add a sticky                                                        |

## Testing

All in `packages/templates/src/template-games.test.ts` unless named:

- Every template builds, opens in Workshop and sits in `games`.
- Every poll button can start (`sessionButtonPlan` is not null), its answers within the wire's `POLL_OPTION_MAX`, and
  every Two Truths poll asks "Which one is the lie?"; every Picker over written options has them, and the Bingo grid
  has sixteen distinct prompts.
- Every player's sticky is a sticky preset's paper and ink.
- Every preview draws inside its viewBox and tells a hover story (`template-previews`).
