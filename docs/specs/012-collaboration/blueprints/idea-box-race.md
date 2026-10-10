# Idea box race blueprint

Derived from [Idea box](../idea-box.md) "Posting at once" and "Racing for the last card", and
[Collaboration race hardening](../collab-race-hardening.md) (the `idea` delta). Defaults applied are rows
IB1 to IB4 in [DEFAULTS.md](DEFAULTS.md).

## Domain and naming

| Term              | Identifier                      | Meaning                                                                                    |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| Idea card id      | `ShapeElement.ideaCardIds[i]`   | The random id of `ideaCards[i]`; `''` or a missing entry is an id-less card                |
| Idea post         | `IdeaPost` (live)               | One press of the composer's send: a card id, its box, its round                            |
| Pending idea post | an `IdeaPost` in `useIdeaPosts` | A post the room has not answered yet                                                       |
| Yield             | `yieldIdeaToPeer`               | A full box with a pending own card takes a peer's card and lets the newest pending card go |
| Refused idea post | `IDEA_BOX_FULL_MESSAGE`         | A pending post whose card left the box by a yield                                          |

"Card" always means an entry of `ideaCards`; "post" always means this browser's send of one.

## Behaviour and state

A pending post moves through: **pending** (registered at the press, card applied locally) to
**settled** (removed from the pending map) by exactly one of:

1. **Answered**: `room.sequence(op)` resolved (true or false): the post resolves `true`.
2. **Gone quietly**: the element or tab is missing, or `collabRound` differs from the post's round:
   resolves `true`, no notice.
3. **Yielded**: the post was `seen` (its id was in the box after the press) and its id is no longer in
   `ideaCardIds` while the round is unchanged: resolves `false`, and the notice shows.

`seen` guards a check that runs before the press's own render commits. Invariant: a settled post is
never taken back; only a pending one can yield.

`yieldIdeaToPeer(el, delta, pending)` (pure, `packages/document/src/element-deltas.ts`):

- Not an `idea` delta, not a shape, another round, malformed text, a box under `IDEA_MAX_CARDS`, a
  delta id the box already holds, or no pending id in the box: `{ el: applyElementDelta(el, delta),
yielded: null }`.
- Otherwise: remove the card of the newest pending id present (IB1), then apply the delta:
  `{ el, yielded: id }`.

## Interfaces and contracts

- `ElementDelta` `idea`: `{ kind: 'idea'; text: string; round?: string; id?: string }`. An `id` that is
  not a non-empty string of at most `IDEA_CARD_ID_MAX` is ignored (the card goes in id-less).
- `applyElementDelta` `idea`: as before, plus: an id already in `ideaCardIds` returns the same element
  (replay); a card with an id, or into a box that already has `ideaCardIds`, writes
  `alignedIdeaCardIds(el)` plus the id (or `''`).
- `alignedIdeaCardIds(el)`: `ideaCardIds` cut to `ideaCards.length` and padded with `''`.
- `withoutIdeaCard(el, id)`: the box without the card of that id (both lists), or the same element.
- `applyRoomOpToTabs(tabs, op, pendingIdeaIds?)`: an `el-delta` `idea` op runs `yieldIdeaToPeer` with
  `pendingIdeaIds(tabId, elementId)` when it names any id.
- `useIdeaPosts({ tabs, tickTabs, roomRef, onRefused })` returns `post(tabId, element, text):
Promise<boolean>` and `pendingIdeaIds(tabId, elementId): readonly string[]` (post order).
- `useCollabElements.addIdea` returns `false` at the press check, else the post's promise. The
  composer already restores a draft on a promise resolving `false` unless typed into since.
- No new room message: the room's existing `cursor` answer (`sequence`) is the acknowledgement.

## Data and persistence

- `ideaCardIds?: string[]` on `ShapeElement`: stored in the tab JSON beside `ideaCards`, listed in
  `ELEMENT_FIELD_NAMES`, `LIVE_ELEMENT_FIELDS` (re-grafted with the cards on undo) and validated
  (`rowsOf(IDEA_MAX_CARDS, string of at most IDEA_CARD_ID_MAX)`).
- `mergeIncomingElement` keeps the local `ideaCardIds` whenever it keeps the local `ideaCards`;
  `elementChangeIsDeltaOnly` ignores it, like the cards.
- Emptying the box writes `ideaCardIds: []` with `ideaCards: []`.
- No migration: an absent list is a box of id-less cards. The room's ledger keeps texts only, so a card
  it restores into a save comes back id-less (IB2).

## Errors and edge cases

| Case                                            | Handling                                                      |
| ----------------------------------------------- | ------------------------------------------------------------- |
| No live room                                    | `post` settles answered at once; nothing can yield            |
| Socket down or room silent past the ack timeout | `sequence` resolves false: settled answered, never taken back |
| Two own pending posts, one peer card            | The newest pending card yields; the older stays               |
| Peer card already in the box (same id)          | Replay: nothing changes, nothing yields                       |
| Box emptied for a new round while pending       | Settled quietly, no notice                                    |
| Box or tab deleted while pending                | Settled quietly, no notice                                    |
| Stale `ideaCardIds` longer than `ideaCards`     | Cut to length at the next card (`alignedIdeaCardIds`)         |
| Malformed id in a delta                         | Ignored; the card goes in id-less                             |

## Security and trust

The id is a client-minted random UUID: it carries no author and no presence id, so the anonymity rule
holds ([Idea box](../idea-box.md) "Anonymity is structural"). A forged id is bounded and validated; a
peer replaying someone's id only makes its own card a no-op. A Viewer cannot post (the composer is
gated on `can`), so never holds a pending post; an Editor and a Participant post the same way.

## Performance and limits

A yield check is one scan of at most 300 ids per peer idea delta while a pending post exists; the
settle check runs per tabs change over the pending posts (normally none or one, for the round trip).
No new network traffic.

## Presentation and UX

The refused post: the error toast reads **The box filled up before your idea landed.** (IB3), the
draft returns to the composer, and the full box reads **Box is full** with the field off.

## Accessibility

The toast is the editor's existing live region; the restored draft keeps the field's label.

## Observability

`[idea-box] post yielded to an earlier card` (info, with the element id, never the text) when a post
is refused.

## Testing

| Rule                                                        | Test                                                |
| ----------------------------------------------------------- | --------------------------------------------------- |
| Card ids stay aligned, id-less entries padded, replay no-op | `packages/document/src/element-deltas.test.ts`      |
| Yield takes the newest pending card for a peer's            | `packages/document/src/element-deltas.test.ts`      |
| Two posters racing for the 300th card converge              | `packages/document/src/idea-box-race.test.ts`       |
| Merge keeps ids with cards; validation bounds ids           | `element-deltas.test.ts`, `collab-shapes.test.ts`   |
| A peer delta yields only with a pending post                | `apps/live/app/document/[id]/room-op-apply.test.ts` |
| Post lifecycle: answered, quiet, refused with notice        | `apps/live/hooks/collab/useIdeaPosts.test.tsx`      |

## Constants and configuration

- `IDEA_CARD_ID_MAX = 64` (`collab-shapes.ts`, IB4): safe range 36 to 128.
- `IDEA_MAX_CARDS = 300`, unchanged.
