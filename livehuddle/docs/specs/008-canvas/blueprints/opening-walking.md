# Opening walking blueprint

Derived from [Avatar mode](../avatar-mode.md) "Where it lives" and "Opening walking", and from
[Start a Space](../../007-editor/start-diagramming.md) "The Spaces lead".

## Files

| File                                                     | Role                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/editor/lib/walk-entrance.ts`                       | Pure: `walkEntrance(elements)`, the tab's entrance (a pad, an Avatar button) or null |
| `apps/editor/app/document/[id]/useOpenWalking.ts`        | Judges each tab once per visit; asks for the walk; hands the start spot on as `walkIn`       |
| `apps/editor/hooks/canvas/useCanvasTool.ts`              | `openWalking()`: enters Avatar mode as a pick does, remembered, but uncounted                |
| `apps/editor/app/document/[id]/useEditorState.ts`        | Wires the hook: `enabled` off in an embed, `loaded` from `loadedTabIds`                      |
| `apps/editor/app/document/[id]/useTemplateFlow.ts`       | `onLanded(tabId)` after a template lands content, so the tab is judged afresh                |
| `apps/editor/components/canvas/useWalkIn.ts`             | Puts the start spot in `spawnAtRef`, and brings the view to it when it is off screen         |
| `apps/editor/components/canvas/useCanvasAvatar.tsx`      | Calls `useWalkIn` before `useAvatarWalk`, so the enter effect finds the spot                 |
| `apps/editor/components/palette/canvas-tool-options.tsx` | Avatar listed after Hand, group 0, never disabled                                            |
| `apps/editor/lib/editor-commands.ts`                     | `tool:avatar`, Avatar Mode, in the search panel                                              |
| `apps/editor/components/start/start-template-items.ts`   | `LEADING_START_GROUP`, the rail order, `initial`                                             |

## Domain and naming

| Term         | Identifier            | Meaning                                                                          |
| ------------ | --------------------- | -------------------------------------------------------------------------------- |
| Entrance     | `WalkEntrance`        | `{ kind: 'pad' }` or `{ kind: 'button', button }`: why and where a tab walks you |
| Walk In      | `WalkIn`              | `{ button, seq }`: one request to start the character below `button`             |
| Judged       | `judged` (a Set ref)  | The tab ids already looked at this visit                                         |
| Opening walk | `openWalking`         | Entering Avatar mode because the tab offers it, not because someone picked it    |
| Re-judge     | `rejudge(tabId)`      | Forget a tab was judged, for the template that has just landed on it             |
| Spaces lead  | `LEADING_START_GROUP` | `'spaces'`: the group the start lists first and opens on                         |

Synonyms banned: "auto-avatar", "spawn mode", "default tool" (a different feature, `useModeDefaultTool`).

## Behaviour and state

1. The editor passes the active tab's id, elements and whether it has loaded.
2. When the tab has loaded and is not in `judged`, `useOpenWalking` adds it, then reads `walkEntrance`.
3. No entrance: nothing. Already in Avatar mode: nothing more.
4. A button entrance bumps `walkIn` (`seq + 1`) with the button's box; a pad entrance leaves `walkIn` alone, since
   the pad wins in `useAvatarWalk`.
5. It calls `openWalking()`: selection cleared, then `useCanvasTool.openWalking`.
6. `useWalkIn`, a layout effect on `seq`, sets `spawnAtRef` to `avatarSpawnBelow(button, scale)` (the spot a press of
   the button would use, at your character's Size, so the figure stands clear of the button's label) before
   `useAvatarWalk`'s enter effect runs, centres the view on the spot when the spot is outside the canvas, and nudges
   the view by `followCorrection` when the spot is on the canvas but inside `AVATAR_FOLLOW_MARGIN` of an edge (added
   to the current `viewportOffset`). The view is judged once it has settled: the wrapper's box unchanged for
   `WALK_IN_STILL_FRAMES` (6) frames, or after `WALK_IN_MAX_FRAMES` (90), since the tab's fit and the Map's re-fit
   land frames after the tab opens walking; the spot itself is set at once.
7. A template landing calls `onLanded(tabId)`, which removes the tab from `judged`; the next render with its new
   elements judges it again.

`judged` lives for the editor's life, so a tab is judged once per visit. Leaving Avatar mode, then editing the tab,
never brings the walk back.

## Interfaces and contracts

- `walkEntrance(elements: Element[]): WalkEntrance | null`.
- `useOpenWalking({ enabled, tabId, elements, loaded, walking, openWalking }): { walkIn, rejudge }`.
- `useCanvasTool().openWalking(): void`.
- `useWalkIn({ walkIn, scale, spawnAtRef, mainRef, wrapperRef, viewportZoom, viewportOffset, setViewportOffset })`.
- `CanvasProps.walkIn?: WalkIn | null`.

## Data and persistence

Nothing is stored. No API, schema, route or stored key changes: the entrance is read from the tab's own content, so
a Space made by the MCP server or before this change opens walking the same way.

## Errors and edge cases

- A pad and a button: the pad wins, as in `useAvatarWalk`.
- A mode button with no `mode` is an Avatar button (`DEFAULT_BUTTON_MODE`).
- A tab that has not loaded is not judged yet; one that loads empty is judged then and stays judged unless a template
  lands.
- An embed never opens walking (`enabled: false`).
- The canvas not yet measured: the spot is still set, the view is left alone.

## Security and trust

Walking writes nothing to the document, so every role opens walking, a Viewer included. The broadcast of the
character's position follows the existing Avatar mode rules.

## Performance and limits

- Per elements change on the active tab: one `Set.has` and an early return.
- Per judged tab: one scan of its visible elements, stopping at the first pad.
- `useWalkIn` runs once per request (`seq`), reading two bounding boxes.

## Presentation and UX

Avatar sits third in the picker (Select, Hand, Avatar) with its own icon; the start lists the Spaces first and opens
on them. Opening walking shows the character just below the Walk In button, in view.

## Accessibility

The picker entry is a menu item like any other, named "Avatar". Opening walking moves no focus.

## Web Experience

The same on a phone: the picker lists Avatar on mobile; the start opens on the Spaces on every width.

## Observability

Opening walking fires no `Canvas·Used·AvatarMode`; a pick from the picker or search still does.

## Testing

- `lib/walk-entrance.test.ts`: pad, button, none; every Spaces template opens walking, no other.
- `app/document/[id]/useOpenWalking.test.tsx`: once per tab, waits for load, embed, already walking, re-judge.
- `hooks/canvas/useCanvasTool.test.ts`: `openWalking` is remembered and uncounted.
- `components/canvas/useWalkIn.test.tsx`: the spot, the off-screen recentre, once per `seq`.
- `app/document/[id]/useTemplateFlow.tool.test.ts`: `onLanded` on a template, not the blank.
- `components/palette/canvas-tool-options.test.ts`, `participant-palette.test.ts`, `lib/editor-commands*.test.ts`:
  the picker and search list Avatar for every role.
- `components/start/start-template-items.test.ts`, `StartFromTemplates.test.tsx`: the Spaces lead.

## Constants and configuration

- `LEADING_START_GROUP = 'spaces'`.

## Defaults ledger

- Judged once per visit, kept in memory, not stored (the spec says "once per visit").
- The view recentres only when the spot is outside the canvas, so a fitted template is not moved; a spot inside the
  follow margin moves it only by that margin's shortfall, so the character is never left behind the chrome.
