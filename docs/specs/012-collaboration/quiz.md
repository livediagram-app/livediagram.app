# Quiz

Status: **implemented** (first cut, for review).

One multiple-choice question on the board, run by the facilitator: it opens
for everyone at once, locks when its time is up, and the reveal shows the
right answer and who got it.

## Why

The collaboration family can already ask the room what it THINKS (the estimate
card, the temperature check, the poll). None of them can ask what the room
KNOWS. A quiz differs from a poll in exactly the ways that matter in a
workshop: there is a right answer, it is hidden until the facilitator shows
it, the round has a deadline, and the payoff is naming the people who got it.

## The element

A **shape kind**, `quiz`, filed under Behaviour with the other cards that ask
the room. One question per element: a second question is a second element.

- **`label`** is the question, so it edits, searches and exports like any label.
- **`quizOptions?: string[]`**: the answers, 2 to 6 (`QUIZ_MIN_OPTIONS`,
  `QUIZ_MAX_OPTIONS`), each at most `QUIZ_OPTION_MAX_TEXT` characters.
- **`quizCorrect?: number`**: the index of the right answer in `quizOptions`.
- **`quizSeconds?: number`**: how long the round stays open, clamped to
  `QUIZ_MIN_SECONDS`..`QUIZ_MAX_SECONDS` where read. Absent = 20.
- **`quizStartedAt?: number`**: epoch ms the facilitator pressed Start.
  Absent = the round has not been run.
- **`quizLockedAt?: number`**: epoch ms somebody pressed Lock now before the
  time ran out. Absent = the round locks at `quizStartedAt + quizSeconds`.
- **`quizRevealed?: boolean`**: the right answer is showing, for everyone.
- **`responses`**: each person's pick, on the per-participant primitive
  ([Per-participant responses](participant-responses.md)), the value being the
  option's index as a string. One pick per person; picking again replaces it.

## Phases

`quizPhase(element, now)` derives one of five, and every surface reads it
rather than re-deriving from the fields:

| Phase      | When                                                       |
| ---------- | ---------------------------------------------------------- |
| `setup`    | fewer than two non-empty answers, or no valid right answer |
| `ready`    | set up, never started (or reset)                           |
| `open`     | started, and `now` is before the lock time                 |
| `locked`   | the lock time has passed, not yet revealed                 |
| `revealed` | `quizRevealed`                                             |

The lock time is `quizLockedAt ?? quizStartedAt + quizSeconds * 1000`, and
`quizLockAt` is the one function that computes it.

## The face

The element is **a circle with its answers fanned around it**. The box is a
square (aspect-locked on creation) and the face scales uniformly with it, the
same rule as every Collaborate card
([Per-participant responses](participant-responses.md), "The card scales to its box").

- **Setup / ready**: a closed disc showing a large `?`, the number of answers
  and the time limit. The question and the answers are hidden until the start,
  so nobody reads ahead. The facilitator sees Start (or Set up the question).
- **Open**: the question moves into the disc, a countdown ring drains around
  its edge with the seconds left in the middle, and the answers **fan out**
  from the centre to their places on a ring around the disc, one after
  another. Anybody who can edit presses an answer to pick it; their own pick
  is raised; pressing it again withdraws it, pressing another moves it. The
  disc shows how many have answered, never what. The facilitator can Lock now.
- **Locked**: the ring is empty, the answers stop taking presses, the disc says
  "Time's up" and the count. The facilitator sees Reveal.
- **Revealed**: the right answer **animates to green** (a pop and a glow), the
  others fade back, and every answer shows how many picked it with **the
  avatars of who picked it beside it**: above an answer in the top half of the
  ring, below the rest, so the row sits on the outside, away from the disc.
  Five faces at most, then "+N" (which also counts picks from people who have
  since left the room, who have no face to show). The disc keeps only the
  question and the score ("3 of 5 correct"). The facilitator sees Run again.

**The element's stroke colour** draws the outlines when one is set: the
disc's edge, the countdown ring and the answers' borders (full strength on
your own pick, softer on the rest). Unset, they are washes of the text colour,
so an unstyled quiz follows the tab theme. The right answer's green is not
affected.

**Double-click never edits the text.** The label is the question, and the
Edit Quiz dialog is its only editor: editing it inline would print the hidden
question over the closed disc, and would let anyone reword it mid-round.
`opensInlineLabelEditor` is the kind-level gate, read by every entry point
(double-click, Space, type-to-edit).

Answers sit at even angles starting from the top (12 o'clock) and going
clockwise, so answer A is always at the top and the order reads like a clock.

Reduced motion keeps every state and drops only the motion: the answers are
simply in place, the right answer is simply green.

## Running it

| Act               | Who                                                              |
| ----------------- | ---------------------------------------------------------------- |
| Edit the question | the facilitator ([Facilitator](facilitator.md)), else any editor |
| Start, Lock now   | the same                                                         |
| Reveal, Run again | the same                                                         |
| Pick an answer    | everyone with edit rights, while the round is open               |

- **Start** stamps `quizStartedAt`, clears `quizLockedAt`, un-reveals, empties
  `responses`, and mints a new `collabRound`, so a pick from a previous round
  can never land in this one ([Collaboration race hardening](collab-race-hardening.md)).
- **Run again** returns the card to `ready` the same way, with a new round.
- **Edit** is a dialog (Edit Quiz) opened from the card's own `…`: the
  question, the answers with a Correct marker on one, and the time limit.
  Saving is an ordinary undoable edit and returns the card to `ready`, because
  picks cast against the old answers no longer mean anything. It is not
  offered while the round is open.

Presses that run the round (start, lock, reveal, reset) write through the
non-history path like the estimate card's Reveal, and `quizStartedAt`,
`quizLockedAt` and `quizRevealed` are re-grafted onto undo snapshots with the
other live fields, so one person's Ctrl+Z cannot un-start somebody's round.

## Limits, stated plainly

- **The right answer is in the document.** `quizCorrect` syncs to everyone
  like any field, so someone reading the raw diagram (the JSON export, the
  network tab) can see it before the reveal. The face never shows it early,
  and the Edit dialog is only offered to people who can run the card. Hiding
  it for real would need the server to hold it, the way the Q&A board's
  server owns its notes, and is not worth it for a workshop quiz.
- **The lock is each client's clock.** The lock time is the starter's wall
  clock plus the limit, compared against each viewer's own clock, exactly as
  the tab timer is ([Session tools (timer + voting)](session-tools.md)). A
  viewer whose clock is a few seconds off locks a few seconds off.
- **The lock is enforced by the client.** The face stops taking picks once the
  round locks; a pick already in flight at that instant still lands. The
  room does not inspect deltas to refuse late ones.
- **View-role visitors cannot answer**, the rule every response inherits from
  the primitive ([Per-participant responses](participant-responses.md)). They
  see the round and the reveal.
- **Picks name their author** (the primitive is not anonymous), which is what
  lets the reveal say who was right.
