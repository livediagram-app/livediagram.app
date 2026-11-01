# Components: blueprint

Derived from [Components](../components.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                            | Role                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/design/src/components.ts`                             | Types, constants, `isInstance`, `mayGoInComponent`, names, refs                      |
| `packages/design/src/component-resolve.ts`                      | `resolveInstance`, `expandInstances`, override targets                               |
| `packages/design/src/component-make.ts`                         | `makeComponent`, `detachInstance`                                                    |
| `packages/design/src/component-session.ts`                      | The edit session: start, stamp, derive, finish                                       |
| `packages/design/src/component-patch.ts`                        | `ComponentPatch`, `applyComponentPatch`, `diffComponent`                             |
| `packages/design/src/component-validate.ts`                     | `isValidDesignComponent`, `isValidComponentPatch`, instance and member field checks  |
| `packages/api-schema/src/room-messages.ts`                      | `component` joins `SYSTEM_OP_KINDS`; `ComponentRoomOp`                               |
| `apps/api/src/design-room/design-schema.ts`                     | Step adding `components` and `component_refs`                                        |
| `apps/api/src/db/components.ts`                                 | Reads, writes, refs statements                                                       |
| `apps/api/src/routes/component-routes.ts`                       | `GET` / `PUT` / `PATCH /api/designs/:id/components[/:componentId]`                   |
| `apps/api/src/room-scope.ts`                                    | A `component` op reaches a scoped session only when `tabIds` holds its tab           |
| `apps/api/src/design-room/tab-shares.ts`                        | The `components` extra on a shared tab's body                                        |
| `apps/api/src/design-room/component-share.ts`                   | What a shared body carries (8 MB budget) and what a design taking it in keeps        |
| `apps/api/src/component-redact.ts`                              | A main as a reader may see it (Community, comment author ids)                        |
| `apps/api/src/design-room/design-content.ts`                    | A copy carries the library (`DesignCopy.components`)                                 |
| `packages/design/src/design-envelope.ts`                        | The Drive file carries the library (`design.components`)                             |
| `packages/design/src/participant-content.ts`                    | A Participant never adds, changes or takes on an instance or component field         |
| `apps/api/src/thumbnail.ts`                                     | Expands instances with the stored library before drawing                             |
| `apps/live/lib/component-registry.ts`                           | The editor's library for the export renderers (`currentComponent`)                   |
| `apps/live/app/design/[id]/useComponentLibrary.ts`              | Load, apply ops, save (PUT / PATCH), offline, refetch on an unknown id               |
| `apps/live/app/design/[id]/useComponentActions.ts`              | Make, place, detach, override, rename, remove, edit session                          |
| `apps/live/components/canvas/component/InstanceFace.tsx`        | Draws an instance on the canvas (the export renderer, inline SVG)                    |
| `apps/live/app/design/[id]/useComponentSession.ts`              | Derives the main live, on the screen that opened the session only (`owned`)          |
| `apps/live/components/canvas/component/ComponentSessionBar.tsx` | "Editing <name>" with Done                                                           |
| `apps/live/components/palette/ComponentMenuSection.tsx`         | The instance menu's Component section and Overrides                                  |
| `apps/live/components/palette/component-tiles.tsx`              | In This Design: a band (Components tab) or the flyout's first group (CategoryFlyout) |
| `apps/live/lib/export-tab.ts`                                   | `renderTabToSvg` / `renderTabToCanvas` expand instances first                        |
| `packages/design-views`, `packages/agent-verbs`, `apps/mcp`     | The agents' read and write paths                                                     |

## Domain and naming

| Term              | Identifier                                                      | Meaning                                                     |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| Main              | `DesignComponent`                                               | A library entry: `id`, `name`, frame, `elements`            |
| Component library | `ComponentLibrary` (`ReadonlyMap<string, DesignComponent>`)     | The design's mains by id                                    |
| Frame             | `DesignComponent.width` / `.height`                             | The main's own box; its top-left is `0, 0`                  |
| Instance          | `shape: 'instance'`, `isInstance`                               | One element drawing a main                                  |
| Override          | `ComponentOverride`, `componentOverrides`                       | Per main element: `label`, colours, `iconId`                |
| Edit session      | `componentEditBy` on the instance, `componentMember` on members | The main put on the tab as plain elements                   |
| Member            | `componentMember: { instanceId, elementId }`                    | An element of an open session                               |
| Resolve           | `resolveInstance(instance, main, opts)`                         | The main's elements placed in the instance's box            |
| Expand            | `expandInstances(tab, lookup)`                                  | A tab with every instance followed by its resolved elements |
| Component patch   | `ComponentPatch`                                                | `{ name?, archived?, upsert?, remove?, order? }`            |

"Component" in the palette's existing **Components** category (Banner, Callout, ...) names built-in blocks; a design's
own mains are its **In This Design** band. Code never calls a main a "symbol", "master" or "group".

## Behaviour and state

### Resolve

- `sx = instance.width / main.width`, `sy = instance.height / main.height` (a zero frame side reads as 1, D193).
- A boxed element `e` becomes `{ ...e, id: instance.id + '/' + e.id, x: ix + e.x * sx, y: iy + e.y * sy, width:
e.width * sx, height: e.height * sy, layerId: instance.layerId, locked: true }` minus `componentMember`,
  `commentThread`, `link`, `addedBy`.
- An arrow: `free` ends map like points; `pinned` ends re-target `instance.id + '/' + elementId`; `on-arrow` ends
  re-target the same way; `curveOffset`, `elbowOffset`, `curvePoints` scale by `(sx, sy)`.
- Opacity: `(e.opacity ?? 1) * (instance.opacity ?? 1)`, written only when below 1.
- `opts.rotate` (exports): each boxed element's centre turns about the instance centre by `instance.rotation`, which
  is added to its own; free arrow points turn the same way. The canvas passes no rotation (its wrapper turns).
- Overrides (`applyOverride(e, o)`): `label` sets `label` and drops rich-text runs; `fillColor`, `strokeColor`,
  `textColor` set the field and drop the colour's preset / swatch / pen-name bindings that would win over it;
  `iconId` sets `iconId` only when `e` has one.

### Expand

`expandInstances(tab, lookup)` walks `tab.elements` once: an instance with `componentEditBy` set is dropped (its
members draw); an instance whose main resolves stays (as the anchor arrows pin to; renderers draw nothing for it)
and is followed by `resolveInstance(instance, main, { rotate: true })`; an instance without a main becomes the
missing frame, a `rectangle` with a dashed stroke and the label "Missing component" (D194). Returns `tab` itself
when it holds no instance. Linear: one pass, one map lookup per instance.

### Make

`makeComponent(elements, selectedIds, { componentId, instanceId, name, now })`:

1. Refuse `'empty'` with nothing selected, `'locked'` when any is locked, `'kind'` when any fails
   `mayGoInComponent`, `'too_many'` past `MAX_COMPONENT_ELEMENTS` (after expanding selected instances).
2. Expand selected instances in place (detach), then take the selection in array order.
3. Frame = bounding box (boxed boxes, arrow end points). Each element moves by `(-frame.x, -frame.y)`, drops
   `layerId`, `locked`, `componentMember`, `commentThread`, `addedBy`. An arrow end pinned outside the selection
   becomes `free` at its resolved point (`endpointPosition`).
4. Instance: `{ id: instanceId, type: 'shape', shape: 'instance', componentId, x, y, width, height, layerId }` at
   the lowest selected index. An unselected arrow end pinned to a selected element is re-pinned to the instance,
   same anchor.
5. Returns `{ component, elements }`.

### Detach

`detachInstance(elements, instanceId, main, newId)`: the instance replaced (same index) by
`resolveInstance(instance, main, { rotate: true })` with ids from `newId()` (mapping arrow ends), `locked` cleared,
`layerId` kept. An arrow end pinned to the instance becomes `free` at its resolved point.

### Edit session

- `startComponentEdit(elements, instanceId, main, by)`: sets `componentEditBy: by` on the instance; inserts after it
  `resolveInstance(instance, main, { overrides: false })` with ids `${instanceId}-${e.id}` (made unique against the
  tab), `locked` cleared, each marked `componentMember: { instanceId, elementId: e.id }`.
- `activeComponentSessions(elements)`: instances with `componentEditBy`.
- `stampSessionMembers(prev, next, instanceId)`: every element in `next` absent from `prev`, allowed in a component
  and unmarked, gets `componentMember: { instanceId, elementId: its id }`. Runs at the commit choke point
  (`commitTabs`) on the active tab while it has one session.
- `deriveComponentFromSession(elements, instanceId, main, now)`: members in array order; each element's id becomes
  `componentMember.elementId`; positions map back by `((x - ix) / sx, (y - iy) / sy)`, sizes by `1 / s`; pinned ends
  to members re-target their `elementId`, to anything else become free; the frame is kept. Returns `null` with no
  members.
- `finishComponentEdit(elements, instanceId)`: removes members, clears `componentEditBy`. With no members left it
  removes the instance too.

### Patch

- `applyComponentPatch(main, patch, now)`: `remove` drops by id, `upsert` replaces by id or appends, `order` (ids)
  reorders those it names keeping the rest after, `name` clamps, `archived` sets; `updatedAt = now`.
- `diffComponent(before, after)`: the patch turning one into the other (by element reference / JSON equality), or
  `null` when equal.

### Invariants

- I1: an instance is one element; no selection, drag, lock, layer or clipboard path reads `componentId` except to
  carry it.
- I2: `expandInstances` is linear in `tab.elements.length + Σ main.elements.length` over the tab's instances.
- I3: an override is never written into a main; `deriveComponentFromSession` reads members, which carry none.
- I4: resolved ids never collide with tab ids (`/` never appears in a minted id).
- I5: a scoped session never receives a main its tab does not use.

## Interfaces and contracts

```ts
export const INSTANCE_SHAPE = 'instance';
export const MAX_COMPONENT_ELEMENTS = 200;
export const MAX_COMPONENTS = 200;
export const MAX_COMPONENT_BYTES = 256 * 1024;
export const MAX_COMPONENT_OVERRIDES = 200;
export const COMPONENT_NAME_MAX = 60;
export type ComponentOverride = {
  label?: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  iconId?: string;
};
export type DesignComponent = {
  id: string;
  name: string;
  width: number;
  height: number;
  elements: Element[];
  updatedAt: number;
  archived?: boolean;
};
export type ComponentPatch = {
  name?: string;
  archived?: boolean;
  upsert?: Element[];
  remove?: string[];
  order?: string[];
};
export type ComponentLookup = (componentId: string) => DesignComponent | undefined;
export function resolveInstance(
  instance: ShapeElement,
  main: DesignComponent,
  opts?: { rotate?: boolean; overrides?: boolean },
): Element[];
export function expandInstances<T extends { elements: Element[] }>(
  tab: T,
  lookup: ComponentLookup,
): T;
export function makeComponent(
  elements: Element[],
  selectedIds: ReadonlySet<string>,
  opts: MakeComponentOpts,
): MakeComponentResult;
export function detachInstance(
  elements: Element[],
  instanceId: string,
  main: DesignComponent,
  newId: () => string,
): Element[];
export function componentRefIds(elements: readonly Element[]): string[];
export function componentRefIdsFromData(data: string): string[];
```

Wire: `GET /components` → `{ components }`; `PUT` body `DesignComponent` → `{ component }`; `PATCH` body
`ComponentPatch` → `{ component }`. Room: `{ kind: 'component', component, tabIds }` (system), sequenced through
the room's `/mutation` like a changeset, so a reconnecting editor replays it; comment author ids are blanked on the
wire. Rejections: 400
`bad_request` with message `invalid component` / `invalid patch` / `invalid json`, 403 `forbidden` (non-edit grant, or
a tab-scoped Editor replacing a main another tab uses), 404 `not_found` (no main; to a tab-scoped Editor, one another
tab uses), 409 `too_many_components` / `component_busy` (three lost compare-and-swaps), 413 `payload_too_large`.

Validation (`isValidDesignComponent`): `id` 1 to 64 chars without `/`; `name` 1 to 60; `width`, `height` finite and
above 0; `elements` at most 200, each `isValidElement`, each `mayGoInComponent`, ids unique, none an instance or a
member; `updatedAt` finite; `archived` boolean or absent. Instance fields: `componentId` 1 to 64 chars;
`componentOverrides` a record of at most 200 entries, each an object of known keys with string values (label at
most the label cap, colours at most 64, `iconId` an element key); `componentEditBy` 1 to 128 chars.
`componentMember` on any element: `{ instanceId, elementId }`, each 1 to 128 chars.

## Data and persistence

```sql
CREATE TABLE IF NOT EXISTS components (
  id         TEXT    PRIMARY KEY,
  data       TEXT    NOT NULL,   -- the DesignComponent minus nothing, JSON
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS component_refs (
  tab_id       TEXT NOT NULL,
  component_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, component_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS component_refs_component ON component_refs (component_id);
```

- `component_refs` is rewritten from the body on every tab write (the save, a changeset, a seeded create, a copy, a
  share taken in; a Participant's swap only adds) and pruned on every tab delete, in the same batch as `image_refs`.
- A library write (PUT, PATCH) moves the design's `saved_at`, so its preview, Drive file and listing follow. A
  shared tab taken in does not announce the mains it brought to the room (a taken body is not announced either).
- The migration door writes no refs: what it brings in from livediagram.app predates components, so none holds an
  instance.
- A copy of a design copies every `components` row (a one-tab copy, the mains that tab uses). A shared tab's body
  carries `extra.components` (the mains its instances use); taking it in upserts each where the stored `updated_at`
  is older or absent.
- This Browser designs keep the library under the design's offline record (`components`), saved with its tabs.
- Snapshot / restore: a tab's revision history never holds mains; a restored tab draws with today's mains.

## Errors and edge cases

- A missing main: the canvas shows "Missing component" (or "Loading component…" while the library loads); exports
  draw the missing frame; Detach and Edit Component are disabled.
- An archived main: draws; absent from the band; Make Component's name count skips nothing (D195).
- A session seen on a screen that did not open it (a peer, the person's other device, a reload): the start and Done
  arrive one element op at a time, so that screen never derives live (`owned` holds only the sessions this screen's
  `startEdit` opened); `finishEdit` derives once from the members as they stand when this person presses Done there.
- A library op older than one already seen for that main (ops can pass each other): dropped (`noteStored`).
- Two sessions on one tab: each instance's own; `stampSessionMembers` stamps only while exactly one is open on the
  tab (D196).
- Deleting a session's instance (it is hidden, but an undo can do it): its members stay as plain elements.
- A patch to a main that is gone: 404; the editor drops its pending patch and refetches.
- Paste of an instance with no main in the payload or library: kept; draws missing until the library has it.

## Security and trust

- Writes need an edit grant (`gateEdit`); a Participant's `el` op that adds or changes an instance is refused by the
  participant content rule (instances are not Participant content).
- A tab-scoped session reads only mains its tab uses, and receives `component` ops only for those (`opForScope`).
- `component` is a system op: a client sending one is dropped.
- Mains carry no images, so placement grants and the media service's references are unchanged.

## Performance and limits

- Resolve and expand are linear (I2). Measured: a 30-screen design, one instance of a 12-element main per screen
  (`components.perf.test.ts`): see the PR's Performance section; the budget is 5 ms for expanding all 30.
- The canvas face memoises its markup on `(instance, main)` identity, so a main change redraws only its instances and
  a drag of one instance re-lays only its box.
- A main change is one `PATCH` (debounced 400 ms per main, D197) and one system op, never a write per instance.

## Presentation and UX

- Session bar: centred at `top-32` (128px, under the 56px header and the category bar's foot at 114 to 120px),
  sized to its content (`w-max`, at most the viewport less 32px); copy "Editing <name>", then " · changes reach every
  instance" from `sm`, and **Done**.
- Component section (instance menu, Tools): name field (Rename Component), **Edit Component**, **Detach Instance**,
  **Reset Overrides**, **Remove from Library**; an **Overrides** accordion, closed until opened.
- In This Design: tiles showing the main's picture (48px tall) with its name under it, tooltip "Place <name>"; two
  columns as a band, three as the flyout's first group under an `h4` like the flyout's own group headings.
- Disabled Make Component tooltip: "Images, videos, embeds, link cards and tab windows can't go in a component yet."

## Accessibility

- The session bar is a `role="status"` region; Done is a button reachable by Tab; Escape with nothing selected is
  Done.
- Override fields are labelled by the main element's name ("Text: Home", "Fill: Nav background").
- Every control has a tooltip and a pointer cursor; tiles are buttons named by the main, tooltip "Place <name>";
  the band is a `section` labelled "In This Design".

## Web Experience

- The instance face and the menu section load with the editor chunk already holding the export renderer; no new
  request before first paint. The library read runs beside the design read, never after it.

## Observability

- `console.warn('[components] patch failed', status)` and `[components] library load failed` on failures; a refused
  write reports `Http<status>.SaveComponent` through the api client's error reporter.
- Telemetry as the spec lists.

## Testing

| Rule                                                    | Test                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| Resolve scales, re-ids, applies overrides               | `packages/design/src/component-resolve.test.ts`               |
| Expand keeps anchors, drops sessions, draws missing     | `component-resolve.test.ts`                                   |
| Make: frame, arrows, refusals, instance placement       | `component-make.test.ts`                                      |
| Detach: fresh ids, overrides baked, arrows freed        | `component-make.test.ts`                                      |
| Session start / stamp / derive / finish                 | `component-session.test.ts`                                   |
| Only the opening screen derives live; Done derives once | `useComponentActions.test.tsx`, `InstanceFace.test.tsx`       |
| Patch apply and diff                                    | `component-patch.test.ts`                                     |
| Validation of mains, patches and instance fields        | `component-validate.test.ts`                                  |
| Linear expand on 30 screens                             | `components.perf.test.ts`                                     |
| Routes: roles, scope, caps, merge per element, op sent  | `apps/api/src/routes/component-routes.test.ts`                |
| Refs kept on tab writes; copy carries the library       | `apps/api/src/db/components.test.ts`                          |
| Shared tab carries mains, later wins                    | `design-room/component-share.test.ts`, `design-room-store`    |
| Room sequences the op; scope filters it                 | `apps/api/src/design-room.test.ts`, `room-scope.test.ts`      |
| Participant never touches a component                   | `packages/design/src/participant-content.leak.test.ts`        |
| Thumbnail and tab render draw instances                 | `apps/api/src/thumbnail.test.ts`, `tab-render-route.test.ts`  |
| Drive file carries the library                          | `design-envelope.test.ts`, `routes/internal-file.test.ts`     |
| Exports expand instances                                | `apps/live/lib/export-tab.test.ts`                            |
| Canvas face draws the main, missing and loading states  | `apps/live/components/canvas/component/InstanceFace.test.tsx` |
| Menu section: overrides, detach, roles                  | `apps/live/components/palette/ComponentMenuSection.test.tsx`  |
| Agents read and write instances                         | `packages/design-views`, `packages/agent-verbs` tests         |

## Constants and configuration

| Constant                     | Value  | Provenance                                         | Safe range     |
| ---------------------------- | ------ | -------------------------------------------------- | -------------- |
| `MAX_COMPONENT_ELEMENTS`     | 200    | A screen header holds tens of elements             | 50 to 1,000    |
| `MAX_COMPONENTS`             | 200    | Far past any design system seen in wireframes      | 50 to 1,000    |
| `MAX_COMPONENT_BYTES`        | 256 KB | 200 labelled shapes measure ~80 KB                 | 64 KB to 1 MB  |
| `MAX_COMPONENT_OVERRIDES`    | 200    | One per main element at the element cap            | = elements cap |
| `COMPONENT_NAME_MAX`         | 60     | The tab name cap                                   | 40 to 120      |
| `COMPONENT_SAVE_DEBOUNCE_MS` | 400    | Below the tab autosave's 600 ms, so instances lead | 100 to 1,000   |

## Defaults ledger

D193 to D197 in [DEFAULTS.md](DEFAULTS.md).
