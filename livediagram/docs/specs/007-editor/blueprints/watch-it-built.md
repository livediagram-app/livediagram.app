# Watch It Built: blueprint

Derived from [Watch It Built](../watch-it-built.md). The spec decides; this file only adds engineering precision.

## Files

| File                                                 | Role                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/editor/lib/replay/replay-store.ts`             | The replay's own store: `active`, the demo elements, the element menu it holds open, and its own selection store. No React           |
| `apps/editor/lib/replay/watch-it-built-script.ts`    | The script, pure: the chapters (`id`, length, words), the demo at any moment (`demoAt`), and where Example is heading (`cursorPlan`) |
| `apps/editor/app/document/[id]/ReplayScope.tsx`      | While the replay runs, re-provides the editor context to the canvas and the element menu with the demo drawn in (see "The scope")    |
| `apps/editor/components/tour/WatchItBuiltHost.tsx`   | The offer, the taken record and the Settings rerun; mounts the player on a press. Replaces `TourHost` in `EditorTours`               |
| `apps/editor/components/tour/WatchItBuiltPlayer.tsx` | Loaded on the press: the clock, applying the script, Example's path, the keys and the ending                                         |
| `apps/editor/components/tour/ReplayOverlay.tsx`      | The player (with Example's line) and Example, portalled over the shield                                                              |
| `apps/editor/app/document/[id]/useEditorState.ts`    | The write freeze                                                                                                                     |
| `apps/editor/lib/telemetry.ts`                       | `pauseTelemetry` / `resumeTelemetry` and `trackDuringPause`                                                                          |

## The scope

The replay never writes the document. `ReplayScope` wraps `EditorCanvasHost` and `EditorContextMenuHost` and, while
`replayStore.active`, provides them a copy of the editor context in which:

- `activeTab.elements` is the person's elements followed by the demo elements;
- `contextMenu` is the replay's (`replayStore.menu`), and `setContextMenu` / `closeContextMenu` write there;
- the selection is the replay's store (a nested `SelectionStoreProvider`), so the real handles, toolbar and
  quick-connect ring draw on demo ids, and presence never sees them (it subscribes to the real store).

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

One `requestAnimationFrame` loop, running only while playing. Time is `(chapter, ms)`. Each frame: `demoAt(chapter, ms,
layout)` gives the demo elements, the selection, the held menu, whether the palette's Shapes flyout should be open, and
how far into the menu Example has gone (`menuDepth`), applied only when they change. The flyout is opened and closed by
pressing the real category button (`[data-tour-id="palette-category"]`), only when its open state differs; the menu's
Style flyout and its Presets section the same way, by pressing their own buttons (found by their words inside
`[data-context-menu]` / `[data-menu-flyout]`) when they are not yet expanded. The pick itself is not pressed: B's green
comes from the demo, as `applyColorPresetToEl` with the theme's Success preset gives it. Example's position is eased
between the screen points of `cursorPlan`'s waypoints, resolved each frame from the DOM (a tour target, a demo element's
rect, the open menu), so it follows a pan or a resize. Each move starts from where Example was last drawn, never
from its last target looked up again: that target can be gone (the palette closed, the menu shut at the end) or moved
(the Presets accordion pushing its rows down), and easing from it made the cursor jump at chapter changes. A carry out
of the palette is the exception: Example is the carried shape's centre, pressed, worked out from the frame (the DOM is
a frame behind as the carry starts), and only when the tile was seen; without it the shape just drops into place.

Seek (a chapter press, Back, reduced motion's Next) just sets `(chapter, 0)`: `demoAt` is a pure function of time,
so there is nothing to replay.

## Layout

At start the demo's anchor is the viewport's centre in canvas coordinates (`computeViewportCenter`, which zoom does not
enter: the canvas scales about the view's centre). Shape A (200 x 56) sits 250 px above it, shape B (200 x 64) 50 px
above it, far enough apart that B's selection toolbar clears A and high enough that the element menu, opened level with
A, ends above the player; colours come from `deriveNewBoxedColours` for the tab, so the demo wears the tab's theme until
the Style chapter gives B the Success preset.

A carried shape starts on the palette's first tile, so the player maps the screen onto the canvas from A's rect while
A waits unseen where it lands: its width gives the zoom, its corner the origin. That reading is taken again on every
frame until the first carry, and the tile's canvas point with it, because A's first frames are still in their
entrance (scaled, 227 x 64 for 200 x 56); a single early reading put the tile hundreds of pixels off the screen.

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

- `watch-it-built-script.test.ts`: every chapter's frames at their beats, the carry, the loose arrow, the typing, the
  menu depth and the green pick; waypoints inside their chapters.
- `replay-store.test.ts`: the store, its reset, and the freeze dropping all four writers only while active.
- `telemetry-pause.test.ts`: the pause, the lift round the replay's own events, and the pause surviving a throw.
- `ReplayScope.test.tsx`: the editor untouched outside a run; the demo, menu and selection inside one.
- `WatchItBuiltHost.test.tsx`: the offer's gates, the press, the taken record, the rerun, one tour at a time.
- `WatchItBuiltPlayer.test.tsx`: start on mount, every ending (Your Turn, Escape, a tab change, unmount), seeking, the
  keys, the clock running through, and reduced motion's Next and Done.
