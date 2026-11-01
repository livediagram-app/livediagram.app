# Vote keys blueprint

Derived from [Session tools](../session-tools.md) "Casting from the keyboard" and
[Canvas accessibility](../../004-interface-design/canvas-accessibility.md#voting-from-the-keyboard). Defaults applied
are rows VK1 to VK3 in [DEFAULTS.md](DEFAULTS.md).

## Domain and naming

| Term             | Identifier                              | Meaning                                                                        |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| Vote key         | `voteKeyDelta(e)`                       | `+` or `=` (a dot on, `1`), `-` (a dot off, `-1`); any modifier but Shift: not |
| Vote by key      | `voteByKey(args)`                       | One vote key applied to the selected element; returns the words it spoke       |
| Dots left        | `dotsLeftText(remaining, budget)`       | `2 of 3 dots left` (`dot` for a budget of one), the Vote panel's words too     |
| Vote key deps    | `EditorKeyboardShortcutsDeps.onVoteKey` | `(elementId, delta) => boolean`: true when the vote took the key               |
| Vote key handler | `voteKeyHandler(ctx, speak)`            | The editor's `onVoteKey`: `voteByKey` with its words spoken; none for a Viewer |

All in `apps/editor/lib/vote-by-key.ts` except the deps field (`hooks/canvas/editor-shortcut-keys.ts`).

## Behaviour and state

`useEditorKeyboardShortcuts`, plain-key branch, after Shift+1 and before type-to-edit: with no text focus, no
label edit, one selected element and no multi-selection, a vote key calls `onVoteKey(selectedId, delta)`; `true`
prevents default and returns, `false` falls through to type-to-edit unchanged.

`voteByKey({ elementId, delta, elements, vote, layers, selfId, canTakePart, cast, retract })`:

1. Not `canTakePart`, no vote, `vote.active` false, the element missing, or `isVotableInVote(el, vote, layers)`
   false: `null` (not the vote's key).
2. `delta` 1: `canCastVote(vote, selfId, id)` false: spent budget speaks `No dots left.`; else (one per item)
   `One dot each: <name> already has yours.` `cast(id)` returns false (edits blocked: a locked tab, VK2): `This tab is locked, so no dot moved.`
   Else `Dot added to <name>. <dotsLeft after>`.
3. `delta` -1: no dot of `selfId` on the element: `No dot of yours on <name>.` `retract(id)` false:
   `This tab is locked, so no dot moved.` Else `Dot removed from <name>. <dotsLeft after>`.

`<name>` is `describeOne(el)`. Dots left after = `max(0, votesPerPerson - votesSpentBy(vote, selfId) ∓ 1)`, read
from the rendered vote. The editor announces the returned words through `announce` (the canvas live region).

`castVote` and `retractVote` (`useTabSession`) return whether a dot moved: false when edits are blocked, the
vote is closed or `canCastVote` says no (cast), or no dot of yours is there (retract). `retractVote` now also
refuses a closed vote, as the stepper (which is gone once casting closes) always did.

## Interfaces and contracts

- `voteKeyDelta(e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): 1 | -1 | null`.
- `voteByKey(...)`: `string | null`; never throws.
- `castVote(id): boolean`, `retractVote(id): boolean` (callers that ignore the result are unchanged).
- `ElementVoteOverlay` stepper buttons: `aria-keyshortcuts="+"` (add) and `"-"` (remove).

## Errors and edge cases

- Shift+`=` is `+` on a US layout and is accepted; layouts where `+` needs AltGr give an `altKey` and are not (VK1).
- A key with nothing selected, several selected, or a non-votable selection is not the vote's.
- A refusal is spoken, never silent; the selection does not change.
- An element another participant holds (the concurrent-selection lock) is skipped by the walk as before, so no
  vote key reaches it until the holder moves on; the lock is not loosened during a vote (a selection also nudges,
  deletes and edits).

## Security and trust

No new trust boundary: the dot travels as the existing `vote` room op, which the room refuses from a view role.
The editor gate is `can.takePart`, as the pointer's (`CanvasElementsLayer`).

## Performance and limits

One branch on the keydown path, reached only for a single selection and one of three keys; `voteByKey` is one
`find` over the tab's elements and one `votesSpentBy` over the vote map: linear, per key press, never per frame.

## Accessibility

The live region speaks each outcome (polite). `useCanvasA11y` does not speak a selection change over a verb
spoken since it (a vote key pressed straight after Tab), as it already did not for a clear. The stepper's buttons carry `aria-keyshortcuts`.

## Observability

A cast or retract tracks `Element` `Voted` / `Element` `Removed` `Vote` from the shared handlers, so keyboard
dots count with pointer dots. Refusals emit nothing (VK3).

## Testing

- `lib/vote-by-key.test.ts`: every branch of `voteKeyDelta` and `voteByKey` (roles, closed vote, layer scope,
  budget, one per item, blocked, retract with none), `dotsLeftText`.
- `hooks/canvas/useEditorKeyboardShortcuts.dom.test.tsx`: a vote key reaches `onVoteKey`; a false falls through to
  type-to-edit; a Viewer session (no `onVoteKey`) is left alone.
- `hooks/persistence/useTabSession` vote tests: the boolean results.
- Role: an Editor and a Participant cast by key, a Viewer cannot (`vote-by-key.test.ts`).
- `hooks/canvas/useCanvasA11y.announce.test.tsx`: a verb spoken in the frame after a selection change is not spoken
  over by `Selected …` (a vote key pressed straight after Tab).
- `e2e/vote-keys.spec.ts`: an Editor and a Participant, by keyboard alone (F6, Tab, `+`, `=`, `-`), cast and take
  back dots and both screens converge; the budget refusal is spoken; a Viewer's `+` casts nothing.

## Constants and configuration

The keys: `VOTE_ADD_KEYS = ['+', '=']`, `VOTE_REMOVE_KEYS = ['-']`.

## Defaults ledger

VK1 to VK3.
