# Sidebar width: blueprint

Derived from [sidebar-width.md](../sidebar-width.md). The spec decides; this file only adds engineering precision.
Defaults are cited as `SWn` ([DEFAULTS.md](DEFAULTS.md)). Paths are relative to the repository root.

| File                                                                | Role                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/workbench/src/lib/sidebar-width.ts`                       | The steps, the bounds, `sidebarDefaultWidth`, `clampSidebarWidth`, storage     |
| `packages/workbench/src/hooks/ui/useSidebarWidth.ts`                | One store per storage key; the hook every reader and the handle share          |
| `packages/workbench/src/components/canvas/SidebarResizeHandle.tsx`  | The handle: pointer drag, keys, double-click reset, hover and focus line       |
| `packages/workbench/src/lib/contents-sidebar.ts`                    | `CONTENTS_SIDEBAR_WIDTH` (236, the base), `CONTENTS_SIDEBAR_WIDTH_KEY`         |
| `packages/workbench/src/components/canvas/PageContentsSidebar.tsx`  | Contents draws at `useContentsSidebarWidth()` and holds the handle             |
| `liveknowledge/apps/editor/components/page-tree/page-tree-width.ts` | `usePageTreeWidth()`: the page tree's base (`PAGE_TREE_WIDTH` 264) and its key |
| `packages/ui/src/hint/useHint.ts`, `packages/ui/src/Tooltip.tsx`    | `focused`: a tooltip opened by its row's keyboard focus                        |

## Domain and naming

| Term          | Identifier                                           | Meaning                                                                 |
| ------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Base width    | `base` (`CONTENTS_SIDEBAR_WIDTH`, `PAGE_TREE_WIDTH`) | The sidebar's own width below the first step                            |
| Step          | `SIDEBAR_WIDTH_STEPS`                                | `{ minWindow, width }`: from `minWindow` px of window, at least `width` |
| Default width | `sidebarDefaultWidth(base, window)`                  | `max(base, the widest step the window reaches)`                         |
| Chosen width  | `custom`                                             | The width the person dragged or keyed, kept per key; null for none      |
| Width         | `width`                                              | `custom ?? default`: what the sidebar and the chrome beside it draw at  |

## Behaviour and state

- `SIDEBAR_WIDTH_STEPS` = 1,440 to 272, 1,520 to 296, 1,600 to 320. `useSidebarWidth(key, base)` reads one
  `useMediaQuery('(min-width: Npx)')` per step, so a window resize re-renders only when it crosses a step.
- The store (`sidebarWidthStore(key)`, module scope, one per key) holds the chosen width, read from `localStorage` on
  first use and cached. `set(w)` updates it and notifies (live, during a drag; not written); `commit(w)` sets and writes;
  `reset()` clears it and removes the key. `useSyncExternalStore` subscribes every reader: the sidebar, the handle and
  the chrome (`CanvasChrome`, `usePageTreeChrome`), so all of them render the same width in the same frame.
- The handle (`SidebarResizeHandle`): `pointerdown` (primary button, not touch) captures the pointer and records the
  start x and width; `pointermove` sets `start + dx / scale`, clamped, once per animation frame; `pointerup` commits;
  `pointercancel` or Escape (heard on the document in the capture phase while dragging, since the pressed handle takes
  no focus) calls `cancel`, which puts the drawn width back to the kept one. Double-click resets. Keys: ArrowLeft and ArrowRight by
  `SIDEBAR_WIDTH_KEY_STEP` (8) or `SIDEBAR_WIDTH_KEY_STEP_LARGE` (32) with Shift, Home and End to the bounds, Enter
  resets; each key commits.
- During a drag `document.documentElement` wears `cursor: col-resize` and `user-select: none`, removed at the end and on
  unmount.
- The store keeps two values: `value` (drawn now) and `kept` (last kept). `set` moves `value` only; `commit`, `reset`
  and `cancel` settle both. The hook returns `width` (drawn), `settledWidth` (kept, or the default) and `dragging`.
- Contents' film rows size from a CSS variable the sidebar sets, `--contents-film-w` = `settledWidth` - 64 (the number
  column and the row's padding), so a drag moves only the aside's edge and the film rescales once, on release: each picture is
  `calc(var(--contents-film-w) * k)` wide with its aspect ratio, `k = min(1, FILM_MAX_H / FILM_MAX_W x aspect)`.
  Outside the sidebar the variable is unset and the film keeps its 172 px. The name span is `relative z-10`, above the
  row's stretched button, so its tooltip hears the pointer.
- `ContentsSidebar` frames the page in view again (one animation frame later) whenever `settledWidth` changes after
  mount. liveknowledge's page surface (`usePageSurface`) already relocks on a `ResizeObserver` of the side chrome, so
  the tree's width, live or settled, reframes the page there with no extra wiring.

## Interfaces and contracts

- `useSidebarWidth(key: string, base: number): { width, custom, defaultWidth, set, commit, reset }`.
- `useContentsSidebarWidth()` = `useSidebarWidth(CONTENTS_SIDEBAR_WIDTH_KEY, CONTENTS_SIDEBAR_WIDTH)`.
- `contentsSidebarClearancePx(panelScale, width = CONTENTS_SIDEBAR_WIDTH)` and
  `contentsClusterLeft(docked, panelScale, width = CONTENTS_SIDEBAR_WIDTH)`: the chrome passes the live width.
- `<SidebarResizeHandle label width defaultWidth scale onResize onCommit onReset />`.
- `Tooltip`'s `focused?: boolean` and `useHint`'s `focusHeld`: true while the control the tooltip names holds
  `:focus-visible` outside the tooltip's wrapper (a tree row, a Contents row's stretched button). It opens as keyboard
  focus does and settles when it turns false. The quiet rule still applies, so a name shown whole stays quiet.

## Data and persistence

- Keys: `liveworkspace:contents-sidebar-width` (Contents, on each editor's own origin) and
  `liveknowledge:v2:page-tree-width`. The value is an integer string of px at the panels' scale. Not a synced
  preference (SW1). Unreadable or non-numeric reads as none; a number outside the bounds is clamped (SW2).

## Errors and edge cases

- `localStorage` blocked: `readLocalStorageSafe` and `writeLocalStorageSafe` swallow it; the width lives for the session.
- The pointer leaves the window mid-drag: pointer capture keeps the moves coming; a lost capture (`lostpointercapture`)
  commits where it is.
- A dragged width wide enough that liveknowledge's page rail no longer fits beside it: `pageRailDockWidth` already reads
  the tree's live width, so the rail gives way to its Page Info button, as on a narrower window.

## Performance and limits

- A window resize re-renders on a step crossing only (three media queries). A drag notifies at most once per frame; the
  chrome re-renders its own body (the panels it places are elements its parent made, so React keeps them), the sidebar
  changes its width and one CSS variable, and no Contents or tree row renders.
- The truncated-name tooltip is mounted on the page tree's active row only (as before); a Contents row mounts its name's
  tooltip with the row (memoised), and its focus state renders that one row.

## Presentation and UX

- Handle: `absolute inset-y-0 right-0 w-1.5 cursor-col-resize`, inside the aside (which clips), above its content; its
  line a 2 px `bg-brand-500` (`dark:bg-brand-400`) at the right edge, shown on hover after 100 ms (the motion budget's ceiling for a delay), at once on
  `focus-visible` and while dragging.
- The handle's tooltip is the shared `Tooltip`; it never opens during a drag (a held button opens no tooltip).

## Accessibility

- `role="separator"`, `aria-orientation="vertical"`, `aria-label`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`,
  `aria-valuetext` ("272 pixels"); `tabIndex=0`; `outline-none` with the brand line as its focus indicator (3:1 against
  the sidebar and the canvas, both themes).

## Testing

- `lib/sidebar-width.test.ts`: the default per window (1,279, 1,280, 1,439, 1,440, 1,520, 1,600, 2,560) for both bases;
  clamping; storage read, write, clear and junk.
- `components/canvas/SidebarResizeHandle.test.tsx`: drag (scaled), Escape, double-click, keys, bounds, the touch-only
  device (no handle), the aria values.
- `PageContentsSidebar.test.tsx` and liveknowledge's `PageTreeSidebar.test.tsx`: the width follows a stored width and a
  reset; the default at a wide window.
- `packages/ui/src/Tooltip.test.tsx`: `focused` opens a clipped name's tooltip and leaves a whole one quiet.

## Constants and configuration

| Constant                 | Value                           | Why                                                     |
| ------------------------ | ------------------------------- | ------------------------------------------------------- |
| `SIDEBAR_WIDTH_STEPS`    | 1,440/272, 1,520/296, 1,600/320 | The spec's steps; the page rail still docks at 1,440    |
| `SIDEBAR_MIN_WIDTH`      | 200                             | Under it the film's pictures and the tree's rows crowd  |
| `SIDEBAR_MAX_WIDTH`      | 480                             | A 1,280 px window keeps an 800 px canvas                |
| `SIDEBAR_WIDTH_KEY_STEP` | 8 (32 with Shift)               | The 8 px grid                                           |
| `delay-100` on the line  | 100 ms (a CSS delay)            | A pointer passing over the edge does not flash the line |

## Defaults ledger

- SW1 and SW2 in [DEFAULTS.md](DEFAULTS.md).
