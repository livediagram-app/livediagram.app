# 104 — Portal element

Status: **implemented**.

A **Portal**: a standing ring of energy on the canvas, linked to another one. Click it — or walk an [Avatar-mode](101-avatar-mode.md) character into it — and you come out of the portal it is linked to, on this tab or another.

## Why

A big diagram is a place, and places have shortcuts. Two portals turn "scroll across the canvas hunting for the other half of this flow" into one click, and they make an Avatar-mode walkthrough feel like moving between rooms rather than panning a plane. It is the cheapest possible in-diagram navigation: no minimap coordinates, no bookmarks UI, just a thing you step into.

## The element

- A **shape kind**, `portal`, like the Selection Mode button ([spec/103](103-mode-button.md)) and the Page ([spec/100](100-page-element.md)) — so it inherits colours, shadow, layers, groups, comments, export.
- Portal-shaped: 72x112, taller than wide, drawn as a tall oval — an outer bloom, a bright rim lit from the crown, a dark mouth you see "through", and a few motes caught in the swirl. **Aspect-locked on creation**, because stretched wide it stops reading as a portal; unlockable from the menu like any element.
- It **paints its own ring**, so the element box behind it is transparent and borderless (the same family as charts, rails, and code blocks). `strokeColor` is the colour of the energy, not of a border: electric blue by default, recolourable from the menu (an orange partner is the obvious second half).
- The link lives in **`ShapeElement.portalTarget`** — the id of the portal this one leads to. Element ids are unique across the diagram, so no tab component is stored; the tab is looked up.

## The name is menu-only

A portal has no caption on the canvas: a label across the energy read as a sticker on a window, and the ring is recognisable without one. The name lives in the element menu (**Tools › Portal → Name**), and shows in the travel tooltip and in the picker.

New portals arrive **unlabelled** and are named **positionally** — "Portal 1", "Portal 2", in tab order — so a diagram full of them is navigable without anyone typing a thing. A typed name wins over the number.

## Linking

Right-click a portal → **Tools › Portal**:

- **Name** — a text field, committed on blur / Enter.
- **Leads to** — a grid of every OTHER portal in the diagram, this tab's first; a portal on another tab is labelled `Name · Tab`. The current target is marked active, and picking it again unlinks.
- **Create portal** — always offered, and the only option for the first portal in a diagram: it drops a second portal beside this one, already linked both ways, and selects it so you can drag it where you want.

**A link is two-way.** Whatever you can step into, you can step back out of. Writing one side writes the other, and any third portal still claiming either end is released — a portal leads to exactly one place. Resolution also honours an **incoming** link, so a one-sided pairing written by an import, an older diagram, or the API still returns you.

## Travelling

Pressing a linked portal does up to three things:

1. **Switches tab**, when the far portal is on another one — through the same path a tab link takes, so selection / edit state is cleaned up identically.
2. **Centres the camera** on the far portal.
3. **An Avatar-mode character steps out of it**, at the far portal's base (centred, bottom edge — the avatar's position is its feet).

**Walking into a portal does the same thing.** The walk hook already knows which element the character is standing on; arriving on a portal fires the same travel. Two rules stop that becoming a trap:

- It fires **once on arrival**, not every frame the character stands there.
- The portal it just came OUT of is **ignored until the character steps off it**. Without that, a pair bounces the traveller back and forth forever.

**Dragging a portal never travels.** The press fires on a click and stays silent once the pointer has moved further than a wobble (`usePressWithoutDrag`), because a portal is an element as well as a control.

## Unlinked portals are inert and say so

A portal with no target is a dead ring — dimmed, no bloom, no clicks — and its tooltip reads _"Portal (not linked) — Right-click the portal and open Tools › Portal to pick the one it leads to."_ A portal that silently swallows clicks is worse than one that admits it isn't wired up. The same forgiveness runs through resolution: a target that was deleted, re-pointed at a non-portal, or points at itself resolves to unlinked rather than erroring, because a diagram is edited in any order and a half-wired portal is a normal intermediate state.

## Model + validation

`portalTarget` is validated as a **non-empty string** only. An id that doesn't resolve to a portal is NOT a structural error — the editor resolves the link at press time and renders the portal unlinked if it can't — so the validator has no business rejecting a tab because two elements are mid-rewire.

## Telemetry

Per [spec/22](22-telemetry.md): adding one emits `Element·Added·Portal`; linking / unlinking / renaming emits `Element·Changed·Portal`. Travelling is not tracked — it is navigation, the same as panning, and would be the chattiest event in the app.

## Implementation shape

- **`apps/live/lib/portals.ts`** — the pure half: `portalsOnTab`, `portalName`, `portalSites` + `resolvePortalSite` (the cross-tab pair), `resolvePortalTarget`, `portalExitPoint`, and `viewportOffsetCentredOn`. Unit-tested, including every way a link can be broken.
- **`apps/live/components/canvas/PortalFace.tsx`** — the ring, its lit / dead states, and the press.
- **`apps/live/components/palette/PortalMenuSection.tsx`** — name, candidates, create.
- **`apps/live/hooks/canvas/usePortalSetters.ts`** — the setters, off the style hook because they commit across tabs.
- **`Canvas.tsx`** owns `enterPortal` (it has the viewport, the tabs, and the avatar hook) and hands the same action to both the portal's click and the walk-in, so the two can never drift. The walk hook gains `teleportTo` and an on-arrival portal callback; the two meet through a ref, because each needs the other.
- Wiring: the `portal` kind in `packages/diagram` (union, `SHAPE_KINDS`, default size, factory, `portalTarget` validation), the self-painted render path, the palette tile in **Behaviour**, and the telemetry token.

## Out of scope

- Portals that lead to a saved viewport / zoom level rather than another portal.
- Animating the trip (a fade or a step-through) instead of cutting to the far side.
- Portals to another diagram entirely — that is what an element link already does.
- Locked portals, one-time portals, portals that need a key: fun, and firmly out of scope for a diagram tool.
