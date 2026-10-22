# Game templates

Two session templates for the lighter end of running a room: icebreaker questions and a bingo game.
They open in Workshop ([Workshop mode](workshop-mode.md#templates)) and live in their own catalogue
category, **Games** ([Template categories](../008-canvas/canvas-and-palette.md#template-categories)).

## Why

Workshop already had every piece a warm-up needs: the Picker
([Picker](picker.md)), the reveal zone ([Reveal zone](../009-elements/reveal-zone.md)), timers on session
buttons ([Session button](session-button.md)) and reaction pads ([Reaction pad](../009-elements/reaction-pad.md)).
Nothing put them together, so the first person to run a team game had to assemble one from an empty tab. Every
other session format (retros, brainstorms, a meeting agenda) had a template; games had none, and a game shelved under
Workshops beside the retros is hard to find. They get a category of their own.

## The category

- **Games**, id `games`, "Icebreakers and bingo to warm up the room." (42 characters, in the
  category's 40 to 50 band). Search words: `icebreaker icebreakers warm up energiser fun team building`.
- Primary home of the two templates below. **Doodle Warm-Up** (`doodle-warmup`, primary Brainstorm) is
  cross-listed here: it is a drawn icebreaker game.
- In Start a Workshop ([Templates by mode](../007-editor/templates-by-mode.md#workshop-templates)) the three
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

| Role            | On a game board                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Editor**      | Creates the board from the template; spins the Pickers; starts the timers; edits every element |
| **Participant** | Reacts; adds and writes stickies (hellos, bingo names)                                         |
| **Viewer**      | Watches every spin; writes nothing, so cannot react or add a sticky                            |

## Testing

All in `packages/templates/src/template-games.test.ts` unless named:

- Every template builds, opens in Workshop and sits in `games`.
- The Icebreaker Questions Picker over written options has them, each short enough for the Picker, and the Bingo grid
  has sixteen distinct prompts.
- Every player's sticky is a sticky preset's paper and ink.
- Every preview draws inside its viewBox and tells a hover story (`template-previews`).
