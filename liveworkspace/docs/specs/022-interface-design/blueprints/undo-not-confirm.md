# Undo, not confirm: blueprint

Derived from [undo-not-confirm.md](../undo-not-confirm.md). The spec decides; this file adds engineering precision,
read from the code.

## Files

| File                                                  | Role                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/undo/useUndoableAction.ts`           | `useUndoableAction()`: act, then the Undo toast; `UndoableAction`; `UNDO_FAILED_MESSAGE`                                              |
| `packages/ui/src/undo/revert-step.ts`                 | `revertStep(before, after, current)`: the three-way revert of one step over an id-keyed list                                          |
| `packages/workbench/src/lib/revert-tab-step.ts`       | `revertTabStep`: `revertStep` over a tab's `elements` and `layers`, its other fields as they are now                                  |
| `packages/workbench/src/lib/tab-reset-undo.ts`        | `resetTabUndoable`, `RESET_TAB_WORDS`: Reset canvas (Clear content) in every app                                                      |
| `packages/workbench/src/lib/open-item-delete-undo.ts` | `openItemDeleteUndo`: delete the open item, the Undo toast or its handoff to the Explorer                                             |
| `<app>/apps/editor/lib/document-delete-undo.ts`       | Each app's binding of `openItemDeleteUndo` (its key, tombstones and telemetry); livedesign's is `apps/live/lib/design-delete-undo.ts` |

## `useUndoableAction`

```ts
type UndoableAction = {
  message: string; // the toast's line, saying what happened
  act: () => boolean | void | Promise<boolean | void>; // false: nothing happened, no toast
  undo: () => boolean | void | Promise<boolean | void>; // false or a throw: the undo-failed toast
  undoLabel?: string; // the Undo button's accessible name, "Undo deleting Notes"
  undoFailed?: string; // defaults to UNDO_FAILED_MESSAGE
};
const offerUndo = useUndoableAction(); // (action) => Promise<boolean>, true when it acted
```

- The toast is `toast.action({ key: 'undo:<n>', message, important: true, actions: [{ label: 'Undo', ariaLabel:
undoLabel, onSelect }] })`. Its own key per action, so two quick deletes keep two toasts.
- `important` shows it while notifications are quieted: it is the action's only way back besides Cmd/Ctrl-Z.
- It lasts `TOAST_ANSWER_TIMEOUT_MS` (10 s), longer than an info toast (4 s). The card is `role="status"`, a polite
  live region; Undo is a real button in the tab order.
- `onSelect` runs once: it dismisses the toast (`dismissAction(key)`), then `undo`. Expiry does nothing.

## `revertStep(before, after, current)`

Linear in the three lists (one `Map` per list). Returns `current` itself when there is nothing to take back, so a
caller can skip the commit.

| In the step                           | In `current`                     | Result                                                       |
| ------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| Removed (in `before`, not in `after`) | still absent                     | back, after its nearest earlier neighbour still in `current` |
| Removed                               | present again (someone re-added) | left alone                                                   |
| Changed (in both, `after` ≠ `before`) | still `after` (same reference)   | back to `before`                                             |
| Changed                               | changed again since              | left alone                                                   |
| Added (in `after`, not in `before`)   | still `after`                    | removed                                                      |
| Added                                 | changed since                    | left alone                                                   |

Identity is by reference, as every editor's commits keep untouched items' references. Undo is then an ordinary commit
through the editor's `commitTabs` (or the deck's `commitDeck`), so it reaches the room as ops like any edit, and a
collaborator's work since the step survives.

## Converted actions

| Action                       | Where                                                                | `act`                                              | `undo`                                     |
| ---------------------------- | -------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| Reset canvas (Clear content) | `useTabActions.clearTabContent` in all six apps                      | `resetTabUndoable`: the tab's elements emptied     | `revertStep` on that tab's elements        |
| Delete page                  | liveknowledge `useTabActions.deleteTab`                              | `withPageAndSubpagesDeleted`, the page after opens | `revertStep` on the tabs; the page reopens |
| Delete layer (with elements) | livediagram `useLayersState.removeLayer`                             | `deleteLayer` on the tab                           | `revertTabStep`                            |
| Clear layer                  | livediagram `useLayersState.clearLayer`                              | `clearLayerElements` on the tab                    | `revertTabStep`                            |
| Delete slide                 | livediagram `useSlideDeck.deleteSlide`                               | the slide out of the deck (`commitDeck`)           | `revertStep` on the deck's slides          |
| Clear Dashboard, Start Over  | liveplanner `DashboardSettings`, `usePlanTabActions.changeDashboard` | the layout changed, slot elements pruned           | the closure `changeDashboard` returns      |

Each undo targets the tab (or deck) it acted on by id, so moving to another tab before pressing Undo is safe.
`changeDashboard`'s closure puts `before.dashboard` back only while the tab's dashboard is still the one it wrote, and
the pruned elements through `revertTabStep` either way.

## Share roles

Every converted action sits behind the gate it had (`editsBlocked`, `isReadOnly`, `canEdit`, `may('pages')`): a
Viewer, and a Participant where the action is an Editor's, never reach `act`, so never see the toast.

## Performance

One closure per action, holding the step's `before` and `after` (references, no copies). `revertStep` on 20,000
items stays under its CPU budget (`revert-step.test.ts`, `cpuBudgetMs(200)`).

## Tests

| File                                                                           | Covers                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `packages/ui/src/undo/useUndoableAction.test.tsx`                              | act and undo, aria, nothing on false, quiet, expiry, failure |
| `packages/ui/src/undo/revert-step.test.ts`                                     | every row of the table above, the CPU budget                 |
| `packages/workbench/src/lib/tab-reset-undo.test.tsx`                           | Reset canvas and `revertTabStep`                             |
| `packages/workbench/src/lib/open-item-delete-undo.test.ts`                     | the open item's delete, toast and handoff                    |
| `liveknowledge/apps/editor/hooks/persistence/useTabActions.pages.test.tsx`     | Delete page and its Undo, roles                              |
| `livediagram/apps/editor/app/document/[id]/useLayersState.undo.test.tsx`       | Delete and Clear layer, expiry, roles                        |
| `livediagram/apps/editor/app/document/[id]/useSlideDeck.delete.test.tsx`       | Delete slide, a collaborator's change, read-only             |
| `liveplanner/apps/editor/hooks/plan/usePlanTabActions.undo.test.ts`            | `changeDashboard`'s Undo                                     |
| `liveplanner/apps/editor/components/plan/dashboard/DashboardSettings.test.tsx` | Clear Dashboard and Start Over with no question              |
