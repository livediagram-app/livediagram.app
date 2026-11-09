# Watch It Built: blueprint

Derived from [Watch It Built](../watch-it-built.md). The spec decides; this file only adds engineering precision.

## Files

| File                                                 | Role                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/editor/lib/replay/curriculum.ts`               | The topic cards: each mode's topics in order, by id, name, line, telemetry token and length. All the editor's first load carries                                   |
| `apps/editor/lib/watch-topics.ts`                    | The taken record (`watchTopics`, and the older `tourSeen` as The Basics): taken, owed, mark, offer again, a whole mode                                             |
| `apps/editor/lib/replay/topic.ts`                    | The `Topic` contract: `layout(env)`, a pure `frame(chapter, ms, layout)`, `plan(chapter, layout)` of waypoints, an optional `measure`                              |
| `apps/editor/lib/replay/topics/*.ts`                 | One file per topic (`diagram-*`, `draw-*`, `workshop-*`), their shared helpers, and `index.ts`, the replays by id                                                  |
| `apps/editor/lib/replay/replay-store.ts`             | The replay's own store: `active`, the demo elements, the held element menu, the tab look and preferences shown, Draw's dock, and its own selection store. No React |
| `apps/editor/app/document/[id]/ReplayScope.tsx`      | While the replay runs, re-provides the editor context to the canvas, the element menu and the editor's modals with the demo drawn in (see "The scope")             |
| `apps/editor/components/tour/WatchItBuiltHost.tsx`   | The offer in Diagram, Draw and Workshop, the start panel, a pick's record, More Topics and the Settings rerun                                                      |
| `apps/editor/components/tour/WatchStartPanel.tsx`    | The start panel in the player's place; its rows are the workbench's `TourTopics`, shared with liveplanner                                                          |
| `apps/editor/components/tour/WatchItBuiltPlayer.tsx` | Loaded on a pick: the clock, applying a topic's frames, Example's path, the keys and the ending                                                                    |
| `apps/editor/components/tour/replay-dom.ts`          | Finding what Example points at, `OPENABLES` (the chrome a frame may hold open, by its own buttons), menu sections, typing                                          |
| `apps/editor/components/tour/ReplayOverlay.tsx`      | The player (with Example's line) and Example, portalled over the shield                                                                                            |
| `apps/editor/app/document/[id]/useEditorState.ts`    | The write freeze                                                                                                                                                   |
| `apps/editor/lib/telemetry.ts`                       | `pauseTelemetry` / `resumeTelemetry` and `trackDuringPause`                                                                                                        |

## The scope

The replay never writes the document. `ReplayScope` wraps `EditorCanvasHost`, `EditorContextMenuHost` and
`EditorModals` and, while `replayStore.active`, provides them a copy of the editor context in which:

- `activeTab.elements` is the person's elements followed by the demo elements, and the frame's `tab` (a look's theme,
  finish, font and background; a session's timer or vote) is laid over the tab, so the canvas, the Session strip and
  the Tab Style dialog all show it;
- `userPreferences` has the frame's `prefs` laid over it (Draw's board background);
- `contextMenu` is the replay's (`replayStore.menu`), and `setContextMenu` / `closeContextMenu` write there;
- the selection is the replay's store (a nested `SelectionStoreProvider`), so the real handles, toolbar and
  quick-connect ring draw on demo ids, and presence never sees them (it subscribes to the real store).

Draw's dock draws inside the scope, but its model is built by `useEditorState` outside it, so a frame's `dock`
(the tool in hand, a marker's colour and width, Shape recognition) and its `prefs.drawPattern` reach it through
`withReplayDock` (`lib/replay/replay-dock.ts`), which `WhiteboardDock` applies to the model it draws while
`replayStore.active`. The model's actions stay the real ones and are never called: the replay opens a dock flyout
only by pressing its own button, and a marker's flyout only while the button reads as in hand (`aria-pressed`),
where a press opens the flyout and never picks the pen up.

The two providers are there whether or not a replay runs, holding the editor's own context and selection store
outside one, so the canvas never remounts as a replay starts or ends (it once did, and the Quick Style panel, placed
against the canvas it had measured, landed off the screen afterwards).

Everything else (autosave, the unload save, the offline copy, room ops, undo, export) reads the real `tabs`, which
the replay never touches.

## The freeze

`useEditorState` wraps the history's `commit` and `tick` so they return at once while `isReplayActive()`, with a
`debugLog` naming the drop. Undo and redo return the same way. Remote applies are not wrapped: collaborators' edits
keep arriving.

## The fade

While active, `document.documentElement` carries `data-replay`; `globals.css` draws every element whose id is not a
demo id (`wib-` prefix) at 25% opacity.

## The clock

One `requestAnimationFrame` loop, running only while playing. Time is `(chapter, ms)`. Each frame the player:

1. lets the topic `measure` the screen if it needs to (where a palette or search tile is, read again until its carry
   starts, since a flyout can still be settling as it opens);
2. applies `topic.frame(chapter, ms, layout)`: the demo elements, the selection, the held menu, the tab look,
   preferences and dock shown, all only when their JSON signature changes; a new look eases in through
   `easeNextStyleChange`, as a pick in the dialog does;
3. holds open what the frame's `open` names and closes the rest it opened, newest first (`syncOpen`): a panel inside a
   dialog closes before the dialog, or its Back would reopen the dialog's home;
4. opens the element menu as far as the frame's `menu.path`, pressing only section rows (`data-menu-section`, set by the
   workbench's `MenuFlyoutSection` and `MenuAccordionSection`) that are not yet expanded, so a control inside a
   section with the same words (Colours' "Border") is never pressed;
5. types the frame's `typed` text into its field through the input's own setter;
6. moves Example.

A press that would change the tab (a look card, a menu tile, Auto Layout) is never made: only its ring shows, and the
frame draws its result, built with the editor's own functions (`withLookApplied`, `applyColorPresetToEl`,
`cleanupElements`, Draw's `recogniseBoardStroke`, Workshop's `buildDrawnBoxed`), so what it shows is what the press
gives.

Example's position is eased between the screen points of the plan's waypoints, resolved each frame from the DOM (a tour
target, a demo element's rect, a control found by its words or accessible name), so it follows a pan or a resize. Each
move starts from where Example was last drawn, never from its last target looked up again: that target can be gone or
moved, and easing from it made the cursor jump. While a frame `hold`s a canvas point (a carry, a pen stroke) Example is
there, holding.

Seek (a chapter press, reduced motion's Next) just sets `(chapter, 0)`: a frame is a pure function of time.

## Layout

A topic lays its demo out round the view's centre in canvas coordinates (`computeViewportCenter`, which zoom does not
enter: the canvas scales about the view's centre), given the view's size in canvas units so a phone gets a smaller or
stacked demo. Demo content stays above the player, and clear of it when it moves to the top: Look and Feel's row keeps
a fixed screen distance (240 px, 200 on a phone) below the view's top at any zoom, through the layout's `zoom`. Screen and canvas map through the view: a canvas point sits
`(point - centre) * zoom` from the canvas box's middle. While the Tab Style dialog is open (it flies up at the bottom
right, or is a phone's sheet) a frame asks for `player: 'top'`.

## Telemetry

Paused for the run (scripted presses on chrome would otherwise count), lifted around the replay's own events.

## Performance

- **First load.** Only the offer (`WatchItBuiltHost`), the store, the freeze and the scope load with the editor: 2.2 KB
  gzipped, against 2.7 KB for the stepped tour's host and steps they replace. The player, the script and the overlay
  (6.5 KB gzipped) load as one chunk on the press, through `next/dynamic`.
- **Per frame**, only while playing: one `demoAt` (a few object spreads), a JSON signature of three elements to skip
  unchanged frames, and the DOM reads that place Example. The canvas re-renders only when the signature changes (the
  drags and the typing). Measured in a production build, 1440 x 900, over the whole replay: p95 16.7 ms, no frame over
  50 ms; with the CPU throttled 4x on the 20-element flowchart template, p95 16.8 ms and two frames over 50 ms (the
  player's chunk arriving and the element menu's first open, the same cost as a real right-click).
- **Idle cost** when not playing: none. No loop, no listeners beyond the relaunch event.

## Accessibility

The player takes focus as it appears; Space plays and pauses, the arrows step chapters, Escape ends it. The play
button's label names what it does (Pause, Play, Replay, Next, Done). Example's line is a `role="status"`, so a screen
reader hears each chapter's words. Reduced motion steps chapter end states instead of moving anything.

## Testing

- `lib/replay/topics/topics.test.ts`: every topic against its card (length, mode), chapter and telemetry ids unique across the
  curriculum, touch words, no em dashes, frames pure and opening only known chrome on a desktop and a phone, waypoints
  inside their chapters. Each topic has its own test of its beats.
- `replay-dom.test.ts`, `replay-dom-openables.test.ts`: finding by words and accessible names, section rows only,
  closing newest first, typing.
- `watch-topics.test.ts`: the taken record and its legacy mapping.
- `replay-store.test.ts`, `telemetry-pause.test.ts`, `ReplayScope.test.tsx`: the store, the freeze, the pause, the
  scope.
- `WatchItBuiltHost.test.tsx`: the offer's gates per mode, the start panel, a pick's record, More Topics, the rerun, one
  tour at a time.
- `WatchStartPanel.test.tsx`, workbench `TourTopics.test.tsx`: the panel and its rows.
- `WatchItBuiltPlayer.test.tsx`: start on mount, every ending, seeking, the keys, the carry held, and no jumps.
