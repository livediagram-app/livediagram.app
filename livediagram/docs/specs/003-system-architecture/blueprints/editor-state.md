# Editor state: `useEditorState` and its slices

Derived from [Source layout](../source-layout.md#the-editors-state). The editor's state hook is a composer over
one-concern slices; this blueprint fixes the slices, their order, the hand-off between them and the guards that keep
the split behaviour-neutral.

## Files

All under `apps/editor/app/document/[id]/`.

| File                                     | Owns                                                                                                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useEditorState.ts`                      | The composer: calls every slice in order, passes each the slices before it, returns every slice's `view` spread in that order. No state, no effects, no logic.        |
| `editor-state/useEditorDocument.ts`      | Surface flags, workbench session, sign-in, toast and confirm, the load flags, the participant, loaded-tab sets, document id, `hydrated`, the save baseline refs       |
| `editor-state/useEditorUndoState.ts`     | `useDocumentHistory`, the Watch It Built freeze, `tickTabs`, the `commitTabs` choke point, checkpoints, `tabSummaries`                                                |
| `editor-state/useEditorSelection.ts`     | Tab scope and `useEditorUiState` (active tab, selection, editing, format source)                                                                                      |
| `editor-state/useEditorDialogs.ts`       | Panel layout, dialogs, context menu, the join screen flags                                                                                                            |
| `editor-state/useEditorTools.ts`         | Laser, eraser and format settings, the canvas tool, the Format tool, the shortcuts switch, `pickCanvasTool`, `pressModeButton`                                        |
| `editor-state/useEditorCollaboration.ts` | `useEditorRealtime`, element deltas, idea posts, presence state, the role preview, the Participant session                                                            |
| `editor-state/useEditorPersistence.ts`   | Preferences, the persistence slice, share state, document list, Trash, `tabsRef`, autosave, Sync and Take Offline in place, identity bootstrap, the self-save effects |
| `editor-state/useEditorRoom.ts`          | Live poll, resync, changeset feed, reaction bursts, facilitator, Q&A board, `useRoomConnection`, presence broadcast, per-tab load, `retryActiveTabLoad`               |
| `editor-state/useEditorComments.ts`      | Comment threads, teams, mentions, `activeTab`, comment reactions, comment rows, assigned actions, action rows                                                         |
| `editor-state/useEditorModes.ts`         | Editor mode, custom and tag colours, the mode's default tool, the vote's cursor privacy                                                                               |
| `editor-state/useEditorViewport.ts`      | Outbound broadcasts, drag preview, `fireReaction`, the stranded-tab guard, the viewport, keyboard avoidance, `pressFocusButton`                                       |
| `editor-state/useEditorPresentation.ts`  | Slide deck, presenting, the pre-show view, `keyboardEnabled`, slide framing and refit, the `zenMode` override                                                         |
| `editor-state/useEditorFollowing.ts`     | Publishing our view, follow-me, focus landing and invites, the changeset reveal, capabilities, pinch zoom, the deep-link capture, tab-entry effects                   |
| `editor-state/useEditorPresence.ts`      | Presence rows and the poll's roster                                                                                                                                   |
| `editor-state/useEditorEditing.ts`       | The edit gates, the Inbox deep link, `commit`, `commitActiveTab`, style memory and its recording commits                                                              |
| `editor-state/useEditorLayers.ts`        | Layers, creation gates, lane settling, the tour square, undo and redo, the placement helpers                                                                          |
| `editor-state/useEditorEventStorming.ts` | Photo import and the note acts                                                                                                                                        |
| `editor-state/useEditorTabs.ts`          | Tab actions, connected tabs, tab name publishing, folders, document actions, the template flow, the tab's canvas look, Apply to All Tabs                              |
| `editor-state/useEditorSessionTools.ts`  | Timer and vote, Behaviour elements, collaboration elements, the Quiz, Keep Results                                                                                    |
| `editor-state/useEditorCreation.ts`      | Images, notes, drawing, paths, growth, outline, palette creation, inline icons, cell links, selection actions, snap colours, whiteboard dock, Fill, Eraser            |
| `editor-state/useEditorStyle.ts`         | Element style, flowchart setters, `quickStyleDeps`, portal setters, style and cleanup previews                                                                        |
| `editor-state/useEditorInteraction.ts`   | Element links, selection editing, canvas accessibility, vote review, nudge, drag, entity actions, clipboard, board scenes, library shapes                             |
| `editor-state/useEditorKeyboard.ts`      | `toggleZenMode` and `useEditorKeyboardShortcuts`                                                                                                                      |
| `editor-state/useEditorWorkbench.ts`     | Workbench messages and ends                                                                                                                                           |

## The slice contract

- A slice is `export function useEditor<Concern>({ fromA, fromB, ... })`, taking the earlier slices it reads by name
  (`fromDocument`, `fromHistory`, ...), and returning the values later slices read plus `view`, its keys of the
  editor's view-model. `export type Editor<Concern>Slice = ReturnType<typeof useEditor<Concern>>` is the type the
  later slices take; slices import each other's types only.
- The composer's return is `{ ...fromDocument.view, ..., ...fromWorkbench.view }` in slice order. Its type equals the
  single-function hook's it replaced, key for key (checked when the split landed with a type-level equality against
  the old hook). Two keys are written twice and resolve as before: `zenMode` (the panel layout's, then the
  presentation's override, which comes later), and `documentTeamId` / `setDocumentTeamId` (the realtime slice's and
  the explicit key: the same values).
- Each slice's code is the old hook's code moved verbatim; only its inputs are destructured from the slices it takes.

## Order

The slices run in the order the hooks ran in the one function, because React runs a component's effects in hook call
order and several effects here are ordered on purpose (`tabsRef`'s layout effect before every passive effect; the
presentation's view capture before the slide fit). Hooks were moved out of their old position only where they have
no effects or effects that touch nothing the hooks they now precede touch:

- no effects: `useConfirm`, `useToast`, `useEditorContextMenu`, `useEditorComments`, `useEditorActions`,
  `useViewPreview`, `useParticipantSession`, and plain `useState` / `useRef` / `useMemo` / `useCallback`;
- independent effects: `usePresenceState` (its roster ref and idle tick) now runs before `useEditorPreferences` and
  `useEditorPersistence` (preference storage, the document title, the import-error timer).

A value a slice needs from a later one reaches it through a ref the earlier slice owns, read at call time and filled
with `useAssignRef` where the value exists: `activeLayerStampRef` and `photoDraftOpenRef` (history; filled in layers
and event storming), `revealChangesetRef` and `receiveFocusRef` (room; filled in following).

## Performance and limits

- Every `useMemo`, `useCallback` and ref keeps its dependencies; no value in the view-model changes identity more
  often. Three effect dependency lists name a ref or state setter from an earlier slice that the linter cannot see is
  stable (`lastPersistedSelfRef`, `setSelfParticipant`, `pollCollaboratorsRef`): stable identities, so the effects
  run exactly as often.
- Per render the split adds one `view` object per slice (25) and spreads them into the result, about 620 keys, as the
  one literal did.
- Measured when the split landed (jsdom, development React, the hook mounted alone): the same render counts for a
  mount, a commit, a select, a label edit, undo, redo, a zoom (0), a new tab and a tab switch, and the same 224
  view-model keys keeping identity across a re-render; a forced re-render took 0.6 to 0.7 ms against 4.0 to 4.8 ms
  for the one 3,600-line function.

## Testing

- `useEditorState.test.tsx` mounts the composer and holds the render counts of an edit, an undo and a zoom to what
  they are, so a slice that adds a render fails it.
- Each slice's own logic, when it gains any beyond wiring, is tested beside it as `use<Concern>.test.ts(x)`.
