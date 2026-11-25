# Undo, not confirm

Status: shipped

## The rule

An action that can be taken back acts at once and offers **Undo** in a toast. A confirm stays only in front of an
action that can't be taken back.

- **Restorable** (the in-document undo brings it back, or the item waits in a Trash or Archived): no question first.
  It happens on the click, and a toast says what happened with **Undo** ("Deleted “Layer 2” and its 4 elements.",
  **Undo**). Undo puts back exactly what the action took, in the same place and order, for everyone in the room.
- **Permanent** (Empty Trash, Delete Forever, revoking a pass or a pairing, removing a key, resetting settings, deleting
  what has no Trash on the server): the confirm stays, with words that say it can't be undone.
- **A question, not a guard** (a choice the person makes, such as "Delete Its Cards Too?" with Keep Them, Take Offline,
  Sync to Your Account, Publish Instead, Save and Leave): not a confirm in this sense. It stays.

Every confirm a person sees is therefore one worth reading: it guards something that will not come back.

## The Undo toast

One shared helper makes it, so every app says it the same way (`useUndoableAction`, `@liveworkspace/ui/undo`):

- The action runs first. Only once it has done something does the toast appear; an action that did nothing (refused,
  or nothing to remove) says nothing.
- The toast is the shared toast's action toast ([toasts.md](../016-notifications/toasts.md)): one **Undo** button,
  10 seconds up (`TOAST_ANSWER_TIMEOUT_MS`, longer than a plain toast's 4), paused while hovered or focused, closable.
- It shows even with In-Editor Notifications off (`important`): it stands in for the confirm the action no longer
  asks, so it is never silenced.
- Each action gets its own toast (its own key), so a second delete doesn't take the first one's Undo away. At most
  three toasts stand at once, as for every toast; one that leaves is still undone with Cmd/Ctrl-Z, or from the Trash.
- Pressing Undo closes the toast and takes the action back once; a second press does nothing. If the undo itself fails
  (the server refuses), an error toast says so.
- Accessibility: the toast is a polite live region (`role="status"`), so the sentence and its Undo are announced; the
  Undo button is a real button in the page's tab order with an accessible name that says what it undoes ("Undo
  deleting Layer 2"); Escape or the close button dismisses it. **F6** reaches it from anywhere, a focus-trapping
  panel included (Tools, a phone's drawer), says so to a screen reader, and hands focus back once it is used; an Escape
  that closes a panel never takes the toast with it ([Toasts](../016-notifications/toasts.md) "Keyboard and screen
  readers"). It stands beside an open Tools popover, never over its controls.

## Focus

A row deleted from the keyboard never leaves focus on the page itself, where F6 would have nowhere to hand it back
to: focus moves to the neighbouring row's control (the next, else the previous, else the list's add button), and after
Undo to the restored row's control. The slide deck, the Layers panel and the page tree do this
(`../packages/workbench/src/lib/row-focus.ts`).

## Undo through the room, never a stale copy

Undo is a new step through the same path as any edit (the editor's commit, so the room's ops carry it to every
collaborator, and the step can itself be undone with Cmd/Ctrl-Z). It is never a saved copy of the whole tab put back:

- What the action **removed** comes back at its old place (after the nearest earlier neighbour still there), unless
  someone has since put it back already.
- What the action **changed** goes back to how it was, only if nobody has changed it since. A collaborator's later
  edit wins; their work is never overwritten by an Undo.
- What the action **added** goes again, only if nobody has changed it since.
- Anything a collaborator added meanwhile stays.

With nothing changed since, this is exactly the state before the action. (`revertStep`, `@liveworkspace/ui/undo`.)

## Share roles

The actions below are editing actions: an **Editor** has them, and a **Participant** where the app already gives a
Participant that edit (each app's own share-role spec). A **Viewer** never sees the action, so never sees its toast.
Undo is offered only to the person who acted.

## Every confirm, sorted

Paths are relative to the monorepo root. "Undo toast" rows no longer ask.

### Restorable: Undo toast

| Action                                      | Where                                                                                                                                   | Undo puts back                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Reset canvas (Tab menu)                     | livediagram, livedocuments, livedesign, livehuddle, liveplanner, liveknowledge `hooks/persistence/useTabActions.ts` (`clearTabContent`) | every element the reset took, on that tab                                                |
| Delete a layer that holds elements          | livediagram `components/panels/LayerRowMenu.tsx`, `LayersPanel.tsx`                                                                     | the layer at its place in the stack, and its elements                                    |
| Clear a layer                               | livediagram `components/panels/LayerRowMenu.tsx`                                                                                        | the layer's elements                                                                     |
| Delete a slide that frames elements         | livediagram `components/panels/SlideDeckPanel.tsx`                                                                                      | the slide at its place in the deck                                                       |
| Delete a page (and its subpages)            | liveknowledge `hooks/persistence/useTabActions.ts` (`deleteTab`)                                                                        | the pages in their places in the tree, and the links on other pages that pointed at them |
| Clear Dashboard, Start Over as a layout     | liveplanner `components/plan/dashboard/DashboardSettings.tsx`                                                                           | the layout and every slot's content                                                      |
| Delete the open item (from its editor)      | every editor, `@liveworkspace/workbench/lib/open-item-delete-undo`                                                                      | the item, from the Trash (the Explorer offers the Undo on arrival)                       |
| Move to the Trash, Change Folder (Explorer) | `packages/explorer/src/data/useItemActions.ts`                                                                                          | already Undo toasts, no confirm                                                          |

### Permanent: the confirm stays

| Action                                                                                                | Where                                                                                                                                                                                       | Why it stays                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empty Trash, Delete for good                                                                          | `packages/explorer/src/explorer/OpenDialog.tsx`, `TrashPane.tsx`, `panel/TrashSection.tsx`; liveknowledge `page-trash/PageTrashDialog.tsx`; liveplanner `plan/TrashPanel.tsx`               | gone from the Trash for good                                                                                                                                                               |
| Delete an uploaded image                                                                              | every editor's `components/panels/ImagePicker.tsx`; `packages/explorer/src/library/GalleryPane.tsx`                                                                                         | removed from storage                                                                                                                                                                       |
| Delete from the Library, a Saved Design                                                               | `packages/workbench/src/components/library/LibraryPaletteTab.tsx`; livedocuments `page-design/SavedDesigns.tsx`                                                                             | the media Worker deletes the row                                                                                                                                                           |
| Delete a shape library, a walkthrough, a recording                                                    | `packages/explorer/src/library/ShapeLibrariesPane.tsx`, `WalkthroughsPane.tsx`; `packages/walkthrough/src/ui/WalkthroughsTools.tsx`, `RecordDock.tsx`                                       | no Trash on the server                                                                                                                                                                     |
| Delete a folder (account or Offline)                                                                  | `packages/explorer/src/explorer/OpenDialog.tsx`, `this-browser-space/LocalDialogs.tsx`                                                                                                      | the folder itself has no Trash; its contents move up                                                                                                                                       |
| Remove from Shared With Me                                                                            | `packages/explorer/src/explorer/SharedList.tsx`                                                                                                                                             | only the share link brings it back, and then as newly opened                                                                                                                               |
| Revoke a pass, unpair a token, disconnect GitHub or Google Drive, remove a phone, delete a Connection | `packages/explorer/src/dialogs/share/ActivePass.tsx`; every editor's `settings/SettingsTokenPairings.tsx`; liveplanner `automations/github/GithubView.tsx`; `packages/settings-ui/src/…`    | access ends at once for someone else                                                                                                                                                       |
| Reset settings                                                                                        | `packages/settings-ui/src/reset-settings/ResetSettingsRow.tsx`                                                                                                                              | no record of the old values                                                                                                                                                                |
| New address, new link, new secret, turn off a link                                                    | liveplanner `email-intake/EmailIntakeDialog.tsx`, `calendar-feed/CalendarFeedDialog.tsx`, `forms/ShareFormDialog.tsx`; `packages/automations-ui/src/step-panels/IncomingWebhookPanel.tsx`   | the old one stops working for good                                                                                                                                                         |
| Unpublish a site or a roadmap                                                                         | liveknowledge `publishing/PublishDialog.tsx`; liveplanner `roadmap/RoadmapDialog.tsx`                                                                                                       | the address is let go                                                                                                                                                                      |
| Delete a team, remove a member                                                                        | `packages/explorer/src/teams/useTeamActions.tsx`                                                                                                                                            | no Trash for teams                                                                                                                                                                         |
| Delete a rule                                                                                         | `packages/automations-ui/src/RuleMenu.tsx`                                                                                                                                                  | deleted on the server                                                                                                                                                                      |
| Delete a thread, a comment, a label, a question; clear High Scores                                    | liveplanner `plan/threads/ThreadTile.tsx`; liveknowledge `page-comments/PageThreadCard.tsx`, `page-labels/LabelEditView.tsx`, `ask/AskView.tsx`; livehuddle `palette/ArcadeMenuSection.tsx` | deleted on the server, or from this browser only                                                                                                                                           |
| Delete a card type (its cards to the Trash)                                                           | liveplanner `plan/ItemTypeEditor.tsx`                                                                                                                                                       | the type's settings go for good; only its cards wait in the Trash                                                                                                                          |
| Remove the AI key, switch to built-in AI                                                              | liveknowledge `ask/AiSettingsDialog.tsx`                                                                                                                                                    | the key is erased                                                                                                                                                                          |
| Discard changes, discard a rule's edits                                                               | liveknowledge `useEditorPageEditing.ts`; `packages/automations-ui/src/AutomationsDialog.tsx`                                                                                                | never saved, so nothing to bring back                                                                                                                                                      |
| Revert to a snapshot                                                                                  | `packages/snapshots/src/ui/SnapshotRow.tsx`                                                                                                                                                 | replaces every collaborator's work at once; its way back is another revert, from the snapshot taken first                                                                                  |
| Delete a Sheet that takes its sheet, Clear Sheet                                                      | liveplanner `hooks/sheets/useSheetDeleteGuard.ts`, `sheets/SheetSettingsPanel.tsx`                                                                                                          | the cells live in the sheet store, outside the tab; its undo is a step in the plan's own undo timeline, and a toast's Undo outside that timeline can't promise to take back only this step |
| Delete a tab that a form sends responses to                                                           | workbench `chrome/TabMenu.tsx` (liveplanner's `deleteWarning`)                                                                                                                              | a public form stops taking responses at once, outside the document                                                                                                                         |

### A question, not a guard

Board delete's "Delete Its Cards Too?" (liveplanner `useBoardDeleteGuard.ts`), Take Offline and Sync to Your Account
(`useOfflineConversion.ts`, `conversion-handoff.ts`, `OpenDialog.tsx`), Move a card here (`LinkExistingCardDialog.tsx`),
Publish Instead (`RoadmapDialog.tsx`), apply a style to the whole knowledgebase (`KnowledgeStyleDialog.tsx`), Choose
Provider (`AiSettingsDialog.tsx`), Save and Leave (`useEditorPageEditing.ts`), an AI agent's write
(`AgentWriteDialog.tsx`), an archived item (`OpenDialog.tsx`). Each asks the person to choose, so it stays.

## New work

A new destructive action names its row here. If it can be taken back, it uses `useUndoableAction` and never a confirm;
if not, it uses the shared `ConfirmDialog` or `ConfirmPopover` and its words say it can't be undone.
