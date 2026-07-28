# 96 — Scoping a vote to one layer

Status: shipped

## What

When starting a dot-vote (spec/39), the facilitator can pick which **layer**
(spec/74) is votable. Only elements on that layer take dots; everything else
stays on the canvas but recedes, and the votable set is ringed.

The case it solves: a tab where the ideas being voted on share the board with
scaffolding — a background frame, an annotation layer, last round's output. A
whole-tab vote makes all of it a target.

## Set once, at start

`tab.vote.voteLayerId`. Absent = every layer is votable, which is both the
pre-scoping behaviour and what a single-layer tab always gets.

**It cannot change while the vote runs** — to vote on a different layer you end
the vote and start another. Same rule as the privacy switches (spec/39): a
setting the facilitator can flip mid-vote isn't a guarantee anyone can rely on,
and here it would also silently invalidate dots already cast on what was
votable a moment ago.

The `VotePrivacy` type widened to `VoteSetup` (privacy + `layerId`) rather than
growing a third positional argument on `startVote`: everything in it shares one
lifecycle — chosen before the vote, baked in at start, immutable after.

## The picker

**Tab menu → Collaborate → Vote**, above the privacy switches.

- **Pre-selected to the layer the editor is on**, which is almost always the
  one the facilitator has just been building.
- **"All layers"** is an explicit option. Without it a multi-layer tab couldn't
  run an ordinary whole-tab vote, which would be a capability regression.
- **Hidden entirely on a single-layer tab.** Scoping to the only layer is the
  same as not scoping, so the control would be pure noise — and most tabs never
  touch layers at all.

While the vote runs, the scope joins the read-only "…end the vote to change
this" line beside the privacy modes, so what's in force is stated where you'd
otherwise go to change it.

## Showing the votable set

Both halves, per the issue: visible-but-dimmed for the rest, highlight for the
votable.

- **Off-layer elements drop to 0.35 opacity.** Visible, because you need the
  board's context to judge what you're voting on; clearly behind, so the
  votable set reads as the foreground.
- **Votable elements get a soft brand ring** (`ring-brand-400/70`,
  `pointer-events-none` so it can't intercept the cast). Dimming alone tells
  you what _isn't_ a target; the ring answers "where do I click".
- **Both only while casting is open.** After **End vote** the board returns to
  normal, so the results walkthrough reads against the full diagram.

`votableInVote` is resolved **once** in `CanvasElementsLayer`, where the vote
and the tab's layers are both in scope, and passed down — rather than threading
`layers` separately into the gesture hook and the overlay. It folds in the kind
rule too, so a text element on the votable layer still dims: it can't take a
dot either, and pretending otherwise would be a lie.

## Legacy elements

`isVotableInVote` resolves an element's layer through `resolveLayerId` rather
than comparing `element.layerId` directly. Everything authored before spec/74
carries **no** `layerId` and belongs to the base layer — a raw comparison would
make every one of those elements unvotable the instant a scope was set.

## Out of scope

- **Changing the scope mid-vote**, per above.
- **Scoping to several layers at once.** One layer or all of them; a multi-select
  is a lot of UI for a case nobody has asked for.
- **Hiding off-layer elements entirely.** The issue explicitly wanted them
  visible, and they're the context that makes the vote judgeable.
