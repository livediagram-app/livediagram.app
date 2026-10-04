# Selection store and the canvas boundary

Derived from [Canvas performance](../canvas-performance.md), the rules **The canvas re-renders only
for what it shows** and **A selection change re-renders what it touches**. What a click does to the
selection is [Selection clicks](selection-clicks.md); this blueprint is where the selection lives and
who re-renders when it changes.

## Files

| File                                                       | Role                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/live/lib/selection-store.ts`                         | `createSelectionStore`, `Selection`, `SelectionStore`, `EMPTY_SELECTION`            |
| `apps/live/hooks/canvas/useSelectionStore.tsx`             | `SelectionStoreProvider`, `useSelectionStore`, `useSelectionOf`                     |
| `apps/live/hooks/ui/useStableEventProps.ts`                | `useStableEventProps`: every `on*` function prop identity-stable                    |
| `apps/live/hooks/ui/useStableObject.ts`                    | `useStableObject`: a rebuilt data-and-actions object, stable until its data changes |
| `apps/live/components/primitives/withStableEventProps.tsx` | `withStableEventProps(Inner)`: `memo` plus stable `on…` props                       |
| `apps/live/app/document/[id]/editor-ui-state.ts`           | Creates the store; `selectedId` / setters come from it                              |
| `apps/live/components/canvas/EditorCanvasHost.tsx`         | Provides the store; passes the canvas stable event props                            |
| `apps/live/components/canvas/Canvas.tsx`                   | `memo`; no `selectedId` / `multiSelectedIds` props                                  |
| `apps/live/components/canvas/CanvasElementsLayer.tsx`      | No selection props; each view reads its own flags                                   |
| `apps/live/components/canvas/CanvasSelectionToolbars.tsx`  | Subscribes; runs `deriveCanvasSelection` itself                                     |
| `apps/live/components/canvas/selection-aware-views.tsx`    | `SelectableBoxedView`, `SelectableArrowView`, `FreeArrowFrame`                      |
| `apps/live/components/canvas/LayerSelectionChrome.tsx`     | Next-note buttons, quick-connect pluses, union resize box                           |
| `apps/live/hooks/canvas/useCanvasSelectionView.ts`         | `useCanvasSelectionView`, `CanvasSelectionInput`                                    |
| `apps/live/components/panels/SlideDeckPanel.tsx`           | Reads the selection it slides from the store                                        |
| `apps/live/lib/canvas-selection.ts`                        | `deriveCanvasSelection` unchanged; `elementSelectionFlags` added                    |

## Domain and naming

| Term              | Identifier                         | Meaning                                                                 |
| ----------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| Selection         | `Selection`                        | `{ selectedId: string \| null; multiSelectedIds: ReadonlySet<string> }` |
| Selection store   | `SelectionStore`                   | One per editor; holds the `Selection`, notifies on a real change        |
| Element flags     | `ElementSelectionFlags`            | `{ selected, multi, single }` for one element id                        |
| Canvas boundary   | `withStableEventProps(CanvasView)` | The point below which an editor render re-renders nothing by itself     |
| Stable event prop | `useStableEventProps(props)`       | `props` with each `on[A-Z]…` function replaced by a stable forwarder    |

"Selected" keeps its existing meaning: `selectedId` is the single selection, `multiSelectedIds` the
marquee or Shift set, and an element is selected when it is either.

## Behaviour and state

### The store

- `createSelectionStore()` starts at `EMPTY_SELECTION` (`{ selectedId: null, multiSelectedIds: new
Set() }`, frozen).
- `get()` returns the current `Selection`. Its identity changes only on a real change, so it is a
  valid `useSyncExternalStore` snapshot.
- `setSelectedId(next)` and `setMultiSelectedIds(next)` take a value or an updater, exactly as
  React's `setState` (`SetStateAction`), so every existing call site keeps its shape.
- `setSelection(next: Selection)` sets both at once and notifies once.
- A set that changes nothing notifies nobody: the same `selectedId`, or a multi set with the same
  members (size and every member; `new Set()` over an empty set is no change). On a real change the
  store keeps the new `Set` the caller passed; it is never mutated afterwards.
- Listeners run synchronously after the change, in subscription order.
- A handler or effect reads `store.get()` when it runs. A handler that sets and then reads sees the
  new value (unlike a stale closure); every set-then-read in the editor is listed in the plan and
  either reads before it sets or uses `setSelection`.

### Where the store is made

- `useEditorUiState` creates the store once (`useState(createSelectionStore)`) and subscribes to
  the whole `Selection` with `useSyncExternalStore`; `selectedId`, `multiSelectedIds` and the two
  setters it returns come from the store, so every editor hook keeps its inputs. It also returns
  `selectionStore`, which `EditorView` hands to `SelectionStoreProvider` around its tree.
- `multiSelectedIds` is a `ReadonlySet<string>` everywhere it is read: every parameter that took a
  `Set<string>` only reads it (`withFrameContents`, `duplicateElements`, `unionBoxedBounds`,
  `deletableIds`, and the editor hooks' inputs), and nothing mutates the selection in place.

### Subscribing

- `useSelectionOf(select, equal = Object.is)` subscribes with `useSyncExternalStore`, keeps the last
  selected value, and returns it unchanged while `equal(previous, next)`: a subscriber re-renders
  only when what it selected changed.
- `elementSelectionFlags(selection, id)` is pure: `selected` is `selectedId === id ||
multiSelectedIds.has(id)`, `multi` is `multiSelectedIds.has(id)`, `single` is `selectedId === id &&
multiSelectedIds.size === 0`. Element views compare the three booleans.

### The canvas boundary

- `Canvas` is exported as `withStableEventProps(CanvasView)`: a boundary component that runs
  `useStableEventProps(props)` and renders `memo(CanvasView)` with React's shallow comparison.
- `useStableEventProps(props)`: every own property whose
  key matches `/^on[A-Z]/` and whose value is a function becomes one forwarder per key for the boundary's
  lifetime, calling the newest value. An `undefined` handler stays `undefined` (children branch on
  presence). Every other prop, including functions not named `on…` (`chairSitters`,
  `previewDrawnArrow`, the viewport setters), passes through untouched: those are read in render.
- No `on…` prop is called during render; the audit in the plan confirms it, and any found is renamed
  out of the convention rather than wrapped.
- Object props built in the host per render (`esBoardControls`, `slideDeck`) pass through
  `useStableObject`: each function field becomes one forwarder per key calling the newest, and the
  object keeps its identity until a data field changes or a field comes or goes. Their functions are
  actions, never called in render.
- `reshapingArrowId` changes value when a press lands on an arrow (a pending reshape); that is data,
  and re-renders the canvas as it should.
- The canvas no longer receives `selectedId` or `multiSelectedIds`. Inside it:
  - the element layer renders each element through a memoised slot
    (`components/canvas/selection-aware-views.tsx`): `SelectableBoxedView` and `SelectableArrowView`
    read `elementSelectionFlags` for their element and hand the unchanged views `isSelected`,
    `isMultiSelected`, `showHandles` and `showAnchors`; each slot is memoised as the view it wraps
    (plain `memo`, `arrowViewPropsEqual`), so a layer render costs what it did;
  - `showHandles` / `showAnchors` come from `elementGrips(element, single, ctx)` in
    `lib/canvas-selection.ts`, which `deriveCanvasSelection` also uses, so the rule lives once;
  - `FreeArrowFrame` reads `single` for its arrow and portals the free arrow's move frame;
  - `LayerSelectionChrome` (the next-note buttons, quick-connect pluses and union resize box) and
    `CanvasSelectionToolbars` take `selectionInput` (`CanvasSelectionInput`: the derivation's
    inputs other than the selection, memoised in `Canvas`) and call `useCanvasSelectionView`;
  - `Canvas` reads the store with `get()` in handlers (`currentSelection`, `readSelection` for
    `useCanvasSelectHandlers`) and subscribes to one narrow slice, `soleSelectedPathId` (the one
    selected element when it is a path) for the path tool, which flips only for paths;
  - `useQuickRing(store)` closes an open ring on a change of the selected element through a store
    subscription;
  - `SlideDeckPanel` reads `selectionIds(selectedId, multiSelectedIds)` from the store (compared
    with `sameMembers`); `useSlideDeck` no longer returns `selectionCount` / `currentSelectionIds`.
- Above the boundary nothing changes: the editor, the host and its hooks read `selectedId` and
  `multiSelectedIds` from `useEditorUiState` as before.

## Interfaces and contracts

```ts
// apps/live/lib/selection-store.ts
export type Selection = {
  readonly selectedId: string | null;
  readonly multiSelectedIds: ReadonlySet<string>;
};
export const EMPTY_SELECTION: Selection;
export type SelectionStore = {
  get(): Selection;
  subscribe(listener: () => void): () => void;
  setSelectedId(next: SetStateAction<string | null>): void;
  setMultiSelectedIds(next: SetStateAction<Set<string>>): void;
  setSelection(next: Selection): void;
};
export function createSelectionStore(): SelectionStore;
export type ElementSelectionFlags = { selected: boolean; multi: boolean; single: boolean };
export function elementSelectionFlags(s: Selection, id: string): ElementSelectionFlags;
export function sameFlags(a: ElementSelectionFlags, b: ElementSelectionFlags): boolean;
export function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean;
export function selectionIds(selectedId: string | null, multi: ReadonlySet<string>): Set<string>;

// apps/live/lib/canvas-selection.ts
export function elementGrips(
  el: Element,
  single: boolean,
  ctx: GripContext,
): { handles: boolean; anchors: boolean };

// apps/live/hooks/canvas/useCanvasSelectionView.ts
export type CanvasSelectionInput = Omit<DeriveInput, 'selectedId' | 'multiSelectedIds'>;
export function useCanvasSelectionView(input: CanvasSelectionInput): CanvasSelection;

// apps/live/hooks/canvas/useSelectionStore.tsx
export function SelectionStoreProvider(props: {
  store: SelectionStore;
  children: ReactNode;
}): JSX.Element;
export function useSelectionStore(): SelectionStore; // throws outside a provider
export function useSelectionOf<T>(select: (s: Selection) => T, equal?: (a: T, b: T) => boolean): T;

// apps/live/hooks/ui/useStableEventProps.ts
export function useStableEventProps<T extends object>(props: T): T;

// apps/live/hooks/ui/useStableObject.ts
export function useStableObject<T extends object>(value: T): T;

// apps/live/components/primitives/withStableEventProps.tsx
export function withStableEventProps<P extends object>(Inner: ComponentType<P>): ComponentType<P>;
```

- `useSelectionStore()` outside a provider throws `SelectionStoreMissing`: a missing provider is a
  wiring bug, never a silent empty selection.
- The multi set handed to readers is the store's `ReadonlySet`; callers that need a `Set` copy it.

## Data and persistence

- The selection is session state; nothing is persisted. Presence still broadcasts it, now from a
  store subscription in `usePresenceBroadcast` instead of a dependency array.

## Errors and edge cases

- An updater that returns the same value: no notification.
- Clearing an already-empty multi set (`new Set()`): no notification.
- A selected element deleted (locally or remotely): the existing pruning paths call the setters, as
  today; the views of deleted elements unmount.
- Switching tabs clears the selection through the setters, as today.
- A handler running after unmount reads the store, which outlives no editor: the store is created in
  the editor's state and dropped with it.
- Two editors in one page (tests) have two stores; nothing is module-global.

## Performance and limits

- Per selection change: one `get()` comparison per subscriber. With 1,000 element views that is
  1,000 selector calls of O(1) and as many re-renders as views whose flags flipped.
- Budget: marquee release and select within the spec's rows; the target is the editor root plus the
  selection chrome only, measured on the runner (`gh workflow run canvas-perf.yml --ref <branch>`).

## Observability

- `[selection] change` (debug, scope `selection`) `{ single, multi }` on every real change.
- `[selection] store missing` is the thrown error's message.
- The canvas props diagnostic (a development-only patch, never committed) lists the canvas props
  that changed per render; the plan runs it after each phase.

## Testing

| Rule                                                  | Test                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| No-op sets notify nobody; real changes notify once    | `selection-store.test.ts`                                                                               |
| `setState`-shaped setters, updaters see the latest    | `selection-store.test.ts`                                                                               |
| Subscribers re-render only when their slice changes   | `useSelectionStore.test.tsx`                                                                            |
| Missing provider throws                               | `useSelectionStore.test.tsx`                                                                            |
| Event props stable, newest called, presence respected | `useStableEventProps.test.ts`                                                                           |
| An editor render re-renders nothing in the canvas     | `withStableEventProps.test.tsx`: same data, fresh handlers, inner view renders once                     |
| Rebuilt objects stable until their data changes       | `useStableObject.test.ts`                                                                               |
| A selection change renders only the flipped views     | `CanvasElementsLayer.renders.test.tsx`: select one, then another; two views render                      |
| Selection behaviour unchanged                         | the existing selection unit tests and `e2e/select-clicks.spec.ts`, unchanged                            |
| The chrome follows the selection                      | `e2e/selection-chrome.spec.ts`: pluses, grips, union box, free-arrow frame, delete and undo, tab switch |
| The budget                                            | the probe on the branch, then nightly                                                                   |

## Constants and configuration

- None new.

## Defaults ledger

- None: the spec states the behaviour; this blueprint adds no default.
