# Editor state: `useEditorState` and its slices

Derived from [Source layout](../source-layout.md#the-editors-state). The editor's state hook is a composer over
one-concern slices; this blueprint fixes the slices, their order, the hand-off between them and the guards that keep
the split behaviour-neutral. livediagram's editor is cut the same way, slice for slice where the concern exists in
both.

## Files

All under `apps/editor/app/document/[id]/`.

| File                                                                         | Owns                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useEditorState.ts`                                                          | The composer: calls every slice in order, passes each the slices before it, returns every slice's `view` spread in that order. No state, no effects, no logic.        |
| `app/document/[id]/editor-state/useEditorDocument.ts`                        | Surface flags, sign-in, toast and confirm, the load flags, the participant, loaded-tab sets, document id, `hydrated`, the save baseline refs                          |
| `app/document/[id]/editor-state/useEditorUndoState.ts`                       | `useDocumentHistory`, `tickTabs`, the `commitTabs` choke point, checkpoints, `tabSummaries`                                                                           |
| `app/document/[id]/editor-state/useEditorSelection.ts`                       | Tab scope and `useEditorUiState` (active tab, selection, editing, format source)                                                                                      |
| `app/document/[id]/editor-state/useEditorDialogs.ts`                         | Panel layout, dialogs, context menu, the join screen flags                                                                                                            |
| `app/document/[id]/editor-state/useEditorTools.ts`                           | Format settings, the canvas tool (walking included), the Format tool, the shortcuts switch, `pickCanvasTool`, `pressModeButton`, `startFormatPainter`                 |
| `app/document/[id]/editor-state/useEditorCollaboration.ts`                   | `useEditorRealtime`, element deltas, presence state, the role preview, the Participant session and its held walk                                                      |
| `app/document/[id]/editor-state/useEditorPersistence.ts`                     | Preferences, the persistence slice, share state, document list, Trash, `tabsRef`, autosave, Sync and Take Offline in place, identity bootstrap, the self-save effects |
| `app/document/[id]/editor-state/useEditorRoom.ts`                            | Resync, changeset feed, avatar pushes, facilitator, `useRoomConnection`, presence broadcast, per-tab load, `retryActiveTabLoad`                                       |
| app/document/[id]/editor-state/useEditorComments.ts (deleted, Work Item 714) | Comment threads, teams, mentions, `activeTab`, comment reactions, comment rows, assigned actions, action rows                                                         |
| `app/document/[id]/editor-state/useEditorModes.ts`                           | Custom colours, the starting tool, opening walking                                                                                                                    |
| `app/document/[id]/editor-state/useEditorViewport.ts`                        | Outbound broadcasts, drag preview, the stranded-tab guard, the viewport, Avatar mode's camera, keyboard avoidance, `pressFocusButton`                                 |
| `app/document/[id]/editor-state/useEditorFollowing.ts`                       | Publishing our view, follow-me, nudges, travel that keeps walking, focus landing and invites, the changeset reveal, capabilities, pinch zoom, tab-entry effects       |
| `app/document/[id]/editor-state/useEditorPresence.ts`                        | Presence rows and selection locks                                                                                                                                     |
| `app/document/[id]/editor-state/useEditorEditing.ts`                         | The edit gates, the Inbox deep link, `commit`, doors, style memory and its recording commits, the tour square, undo and redo, the placement helpers                   |
| `app/document/[id]/editor-state/useEditorTabs.ts`                            | Tab actions, connected tabs, tab name publishing, folders, document actions, the template flow, the tab's canvas look, Apply to All Tabs                              |
| `app/document/[id]/editor-state/useEditorCreation.ts`                        | Images, notes, drawing and room walls, palette creation, inline icons, selection actions, swatch overrides                                                            |
| `app/document/[id]/editor-state/useEditorStyle.ts`                           | Element style, `quickStyleDeps`, portal setters, style previews                                                                                                       |
| `app/document/[id]/editor-state/useEditorInteraction.ts`                     | Element links, selection editing, canvas accessibility, nudge, drag, clipboard                                                                                        |
| `app/document/[id]/editor-state/useEditorKeyboard.ts`                        | `useEditorKeyboardShortcuts`                                                                                                                                          |

## The slice contract

- A slice is `export function useEditor<Concern>({ fromA, fromB, ... })`, taking the earlier slices it reads by name
  (`fromDocument`, `fromHistory`, ...), and returning the values later slices read plus `view`, its keys of the
  editor's view-model. `export type Editor<Concern>Slice = ReturnType<typeof useEditor<Concern>>` is the type the
  later slices take; slices import each other's types only.
- The composer's return is `{ ...fromDocument.view, ..., ...fromKeyboard.view }` in slice order. Its type equals the
  single-function hook's it replaced, key for key (checked when the split landed with a type-level equality against
  the old hook). `documentTeamId` / `setDocumentTeamId` are written twice (the realtime slice's and the explicit
  key) with the same values.
- Each slice's code is the old hook's code moved verbatim; only its inputs are destructured from the slices it takes.

## Order

The slices run in the order the hooks ran in the one function, because React runs a component's effects in hook call
order and several effects here are ordered on purpose (`tabsRef`'s layout effect before every passive effect).
Hooks were moved out of their old position only where they have no effects or effects that touch nothing the hooks
they now precede touch:

- no effects: `useConfirm`, `useToast`, `useEditorContextMenu`, `useEditorComments`, `useEditorActions`,
  `useViewPreview`, `useParticipantSession` (with the held walk set while rendering), and plain `useState` /
  `useRef` / `useMemo` / `useCallback`;
- independent effects: `usePresenceState` (its roster ref and idle tick) now runs before `useEditorPreferences` and
  `useEditorPersistence` (preference storage, the document title, the import-error timer).

A value a slice needs from a later one reaches it through a ref the earlier slice owns, read at call time and filled
with `useAssignRef` where the value exists: `revealChangesetRef` and `receiveFocusRef` (room; filled in following).

## Performance and limits

- Every `useMemo`, `useCallback` and ref keeps its dependencies; no value in the view-model changes identity more
  often. Two effect dependency lists name a ref or state setter from an earlier slice that the linter cannot see is
  stable (`lastPersistedSelfRef`, `setSelfParticipant`): stable identities, so the effects run exactly as often.
- Per render the split adds one `view` object per slice (19) and spreads them into the result, as the one literal
  did.
- Measured when the split landed (jsdom, development React, the hook mounted alone): the same render counts for a
  mount, a commit, a select, a label edit, undo, redo, a zoom (0), a new tab and a tab switch, and the same
  view-model keys keeping identity across a re-render.

## Testing

- `useEditorState.test.tsx` mounts the composer and holds the render counts of an edit, an undo and a zoom to what
  they are, so a slice that adds a render fails it.
- Each slice's own logic, when it gains any beyond wiring, is tested beside it as `use<Concern>.test.ts(x)`.
