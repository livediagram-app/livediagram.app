# Portal element: blueprint

Derived from [Portal element](../portal-element.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                 | Role                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/document/src/shape-factory.ts`             | 72x112, transparent, `#38bdf8` energy, `aspectLocked`, unlabelled   |
| `packages/document/src/validate.ts`                  | `portalTarget` must be a non-empty string                           |
| `packages/document/src/svg-render-faces.ts`          | The export ring (`'portal'`)                                        |
| `apps/live/lib/portals.ts`                           | Names, sites, resolution, exit point, camera centring               |
| `apps/live/components/canvas/portal-travel.ts`       | `makePortalTravel`: `enterPortal` and `resolvePortal`               |
| `apps/live/components/canvas/Canvas.tsx`             | Builds the travel, wires click and walk-in through `enterPortalRef` |
| `apps/live/hooks/canvas/useAvatarWalk.ts`            | Arrival hook, `teleportTo`, the ignored exit portal                 |
| `apps/live/components/canvas/PortalFace.tsx`         | The ring, lit / dead states, the press, tooltips                    |
| `apps/live/components/canvas/ElementFaceRouter.tsx`  | Renders the face while not editing                                  |
| `apps/live/components/palette/PortalMenuSection.tsx` | Name, Leads to, Create portal                                       |
| `apps/live/hooks/canvas/usePortalSetters.ts`         | Link, unlink, rename, create across tabs                            |
| `apps/live/lib/themes.ts`                            | `deriveNewBoxedColours` leaves a portal's colours alone             |

## Domain and naming

| Term           | Identifier                                        | Meaning                                                |
| -------------- | ------------------------------------------------- | ------------------------------------------------------ |
| Portal         | shape kind `'portal'`                             | The element                                            |
| Target         | `ShapeElement.portalTarget: ElementId`            | The id of the portal this one leads to                 |
| Link           | a pair of `portalTarget`s                         | Two portals pointing at each other                     |
| Incoming link  | another portal's `portalTarget === this.id`       | Honoured when this portal's own target fails           |
| Site           | `PortalSite = { tabId, tabName, portal }`         | A portal with the tab it lives on                      |
| Destination    | `PortalDestination = { portal, tabId, elements }` | The far portal, its tab and that tab's elements        |
| Unlinked       | `resolvePortalDestination(...) === null`          | Dead ring, inert                                       |
| Portal name    | `portalName(elements, portal)`                    | Trimmed label, else `Portal <n>` (per tab) [QF11]      |
| Travel         | `enterPortal(from)`                               | Switch tab, centre camera, place the character         |
| Exit point     | `portalExitPoint(portal)`                         | Bottom centre of the far portal (the avatar's feet)    |
| Arrived portal | `arrivedPortalRef` in `useAvatarWalk`             | The exit portal, ignored until the character steps off |

Banned synonyms: "door" (it survives only as the persisted palette tile id `tools:door`), "pair id",
"teleporter", "warp".

## Behaviour and state

### Resolving (`resolvePortalDestination(from, { elements, tabs, activeTabId })`)

1. With `tabs`: `resolvePortalSite(tabs, from)` searches `portalSites(tabs)` (tab order, then
   element order). Own target wins when it is set, is not `from.id`, and names a portal. Else the
   first site whose `portalTarget === from.id` (D116). A hit returns that site's tab elements.
2. Without `tabs`, or no hit: `resolvePortalTarget(elements, from)`, the same rule on one tab,
   reporting `activeTabId`.
3. Otherwise `null`: unlinked. A deleted target, a non-portal target and a self-target all land
   here, never throw.

### Travelling (`enterPortal(from)`)

1. Resolve; `null` does nothing.
2. If `to.tabId !== activeTabId`, call `onFollowLink({ kind: 'tab', tabId })`.
3. Measure the viewport (`mainRef.current.getBoundingClientRect()`); if present, set the offset to
   `viewportOffsetCentredOn(to.portal, size, zoom)`. A callback ref has no rect and skips this.
4. `teleportTo(portalExitPoint(to.portal), to.portal.id)`: clears the walk target and held keys,
   places the feet, sets `arrivedPortalRef` and `lastUnderFeetRef` to the exit portal.

### Triggers

- **Click.** `PortalFace` wraps a `<button>` in `usePressWithoutDrag(onEnter)`; `onEnter` is
  `resolvePortal(element).travel`, absent when unlinked.
- **Walk-in.** The `useAvatarWalk` effect on `[active, standingOnId]`:
  1. Inactive: clear both refs.
  2. `standingOnId === null`: clear `arrivedPortalRef` (D115).
  3. Same as last frame, or equal to `arrivedPortalRef`: ignore.
  4. A `portal` under the feet: call `onWalkIntoPortal`, which is `enterPortalRef.current`.
- Both triggers run the same `enterPortal`.

### Linking (`usePortalSetters`)

- **Sources:** selected portals on the active tab, else the context-menu target.
- **`setPortalTargetSelected(targetId | null)`** maps every tab: sources take `targetId`; the
  target takes the last source's id (D114); any other portal pointing at a source or at the target
  is cleared. `null` unlinks both ends. Emits `Element·Changed·Portal`.
- **`setPortalNameSelected(name)`** writes the trimmed name, empty clears `label` (D117). Emits
  `Element·Changed·Portal` [QF9].
- **`createLinkedPortal()`** creates a portal `NEW_PORTAL_GAP` to the right (D113), links both
  ways, releases every portal on every tab that pointed at the source [QF10], selects the new one.
  Emits `Element·Added·Portal`.

Invariants:

- **I1:** resolution never returns `from` itself and never throws.
- **I2:** after any setter, no two portals claim the same end (exclusivity on every tab) [QF10].
- **I3:** a walk-in fires once per arrival, and never for the exit portal until the feet reach
  bare canvas.
- **I4:** click and walk-in run one function.

## Interfaces and contracts

```ts
// ShapeElement
portalTarget?: ElementId;

export type PortalBox = { x: number; y: number; width: number; height: number; label?: string };
export type PortalSite = { tabId: string; tabName: string; portal: ShapeElement };
export type PortalDestination = { portal: ShapeElement; tabId: string | undefined; elements: Element[] };
export function portalsOnTab(elements: Element[]): ShapeElement[];
export function portalName(elements: Element[], portal: ShapeElement): string;
export function portalSites(tabs: Tab[]): PortalSite[];
export function resolvePortalSite(tabs: Tab[], portal: ShapeElement): PortalSite | null;
export function resolvePortalTarget(elements: Element[], portal: ShapeElement): ShapeElement | null;
export function resolvePortalDestination(from: ShapeElement,
  ctx: { elements: Element[]; tabs?: Tab[]; activeTabId?: string }): PortalDestination | null;
export function portalExitPoint(portal: PortalBox): { x: number; y: number };
export function viewportOffsetCentredOn(portal: PortalBox,
  size: { width: number; height: number }, zoom: number): { x: number; y: number };
export function makePortalTravel(deps: PortalTravelDeps): {
  enterPortal: (from: ShapeElement) => void;
  resolvePortal: (element: ShapeElement) => { targetName: string | null; travel?: () => void };
};
```

| Input                                     | Handling                                       |
| ----------------------------------------- | ---------------------------------------------- |
| `portalTarget` absent                     | Valid; unlinked unless an incoming link exists |
| `portalTarget` a non-empty string         | Valid, resolved at press time                  |
| `portalTarget` empty string or non-string | `isValidElement` returns `false`               |
| `zoom <= 0` in `viewportOffsetCentredOn`  | Treated as `1`                                 |

## Data and persistence

- **Persisted:** `portalTarget`, `label` (the name), colours. No tab id is stored: element ids are
  unique across the document.
- **Derived, never stored:** positional names, destinations, the arrived portal.
- **Undo:** link, unlink, rename and create are ordinary `commitTabs` writes.
- **Migration:** none; a one-sided link from an import or the API resolves through the incoming
  rule.

## Errors and edge cases

| #   | Case                                      | Handling                                              |
| --- | ----------------------------------------- | ----------------------------------------------------- |
| E1  | Target deleted                            | Unlinked, unless an incoming link exists              |
| E2  | Target re-pointed at a non-portal         | Unlinked                                              |
| E3  | Self-target                               | Unlinked                                              |
| E4  | One-sided link                            | Resolves both ways                                    |
| E5  | Own target and an incoming link disagree  | Own target wins                                       |
| E6  | Far portal on another tab                 | Tab switch first, then camera and character           |
| E7  | Unlinked press                            | Face inert; tooltip explains                          |
| E8  | Drag on the ring                          | Moves, never travels                                  |
| E9  | Arrive on the exit portal                 | Ignored until bare canvas (D115)                      |
| E10 | Exit portal overlaps another element      | Stepping onto that element does not clear the ignore  |
| E11 | Click travel outside Avatar mode          | Camera moves; the remembered character position moves |
| E12 | Create with a third portal on another tab | Released on every tab [QF10]                          |
| E13 | Multi-selection linked to one target      | Last source takes the return link (D114)              |

## Security and trust

- `portalTarget` is an opaque id; resolution only ever reads portals already in the document.
- Travel is local camera movement; nothing is broadcast and nothing is written.
- Any writer can point a portal anywhere; a bad id degrades to unlinked (I1).

## Performance and limits

- `portalSites` scans every tab: `O(total elements)` per resolve.
- `resolvePortal` runs per portal per render (`ElementFaceRouter` calls it twice). With `p`
  portals and `n` elements that is `O(p·n)` per render, fine at the `MAX_ELEMENTS_PER_TAB` scale
  for the handful of portals a board holds.

## Presentation and UX

- **Art:** one SVG on a 24x36 grid, `preserveAspectRatio="xMidYMid meet"`: bloom ellipse, mouth,
  rim with a white-hot crown gradient, inner hairline, three motes. Every tone comes from the
  stroke colour.
- **Lit** (linked): bloom 0.45, full rim, motes visible; hover `brightness(1.12)` (desktop),
  press scale 0.97. **Dead** (unlinked): bloom 0.1, dim rim, motes at 0.35, `cursor-default`.
- **No caption:** the name never renders on the canvas.
- **Palette:** tile `tools:door` ("Add portal") in the **Navigate** accordion
  (`tileGroup: 'move'`) of the Behaviours category.
- **Tooltips:** linked: title "Go to <far name>", description "Click to travel, or walk your
  Avatar-mode character into it. The link works both ways." Unlinked: title "Portal (not linked)",
  description "Right-click the portal and open Portal to pick the one it leads to."
- **Menu:** accordion **Portal**: **Name** field (placeholder = own positional name, commit on
  blur / Enter); **Leads to** two-column tiles, this tab first, off-tab as `Name · Tab`, current
  active, re-pick unlinks; **Create portal** always last.
- **Theme:** `deriveNewBoxedColours` returns early for `portal`; the energy keeps `#38bdf8`.

## Accessibility

- Linked: a native `<button>`, `aria-label` `"<label> — go to <far name>"`.
- Unlinked: a `div` inside the tooltip; no role.
- The art is `aria-hidden`.
- Hover and press are 100 ms transitions; nothing loops.

## Web experience

- **INP:** travel is one offset write plus a tab switch through the existing link path.
- **CLS:** the ring scales inside its fixed box.

## Observability

No log exists today. Proposed fingerprints (gap, see the report):

| #   | Where              | Level           | Fingerprint                                               |
| --- | ------------------ | --------------- | --------------------------------------------------------- |
| O1  | `enterPortal`      | `console.debug` | `[portal] travel from=<id> to=<id> tab=<tabId> via=<via>` |
| O2  | `enterPortal` null | `console.warn`  | `[portal] unresolved id=<id> target=<portalTarget>`       |

`<via>` is `click` or `walk`.

## Testing

| Rule                                                   | Test                                            | File                                                |
| ------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------- |
| Defaults: taller than wide, unlinked, unlabelled, lock | "makes a portal portal-shaped and unpaired"     | `packages/document/src/factories.test.ts`           |
| Candidates and positional names                        | `portalsOnTab`, `portalName` blocks             | `apps/live/lib/portals.test.ts`                     |
| Every broken link resolves to unlinked (E1-E3)         | `resolvePortalTarget` block                     | `apps/live/lib/portals.test.ts`                     |
| Incoming link and precedence (E4, E5)                  | "leads back down an INCOMING link", "prefers …" | `apps/live/lib/portals.test.ts`                     |
| Cross-tab resolution (E6)                              | `resolvePortalDestination` block                | `apps/live/lib/portals.test.ts`                     |
| Exit point, camera centring with zoom                  | `portalExitPoint`, `viewportOffsetCentredOn`    | `apps/live/lib/portals.test.ts`                     |
| Travel order, ignored exit, unlinked inert (I4)        | `makePortalTravel` block                        | `apps/live/components/canvas/portal-travel.test.ts` |
| Not votable                                            | "rejects the interactive Behaviour shapes"      | `packages/document/src/session.test.ts`             |
| Export draws a ring                                    | "draws more than a box and a label"             | `packages/document/src/export-consistency.test.ts`  |
| Two-way link, release, unlink, create, rename (I2)     | none                                            | (gap) [QF9] [QF10]                                  |
| Walk-in once, exit ignored (I3)                        | none                                            | (gap)                                               |
| Drag never travels                                     | none                                            | (gap)                                               |

## Constants and configuration

| Name                        | Value                        | Provenance / safe range                         |
| --------------------------- | ---------------------------- | ----------------------------------------------- |
| `SHAPE_DEFAULT_SIZE.portal` | `{ width: 72, height: 112 }` | Portal-shaped, taller than wide                 |
| Energy colour (factory)     | `strokeColor: '#38bdf8'`     | Electric blue; any colour                       |
| `NEW_PORTAL_GAP`            | `96`                         | Canvas px right of the source; 48 to 200 (D113) |
| Art grid                    | `viewBox="0 0 24 36"`        | Matches the 2:3 default aspect                  |
| `PRESS_DRAG_SLOP_PX`        | `4`                          | Shared press tolerance, screen px               |
