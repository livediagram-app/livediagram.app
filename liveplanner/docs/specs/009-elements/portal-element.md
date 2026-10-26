# Portal element

A **Portal** (`shape: 'portal'`) is a standing ring linked to another portal, on this tab or another. It is a model
kind in the [Behaviours family](../010-palette/palette-top-level-categories.md): no Plan surface places one, and it
arrives with a tab. The model, the linking menu and its setters are in liveplanner; the canvas has no portal face and
no travel, so a portal shows as an empty box with its selection ring and pressing one does nothing.

## The element

- A shape kind, so it inherits colours, shadow, layers, comments and export.
- Portal-shaped: 72 × 112 (`shape-factory.ts`), taller than wide, and kept at that intrinsic size whatever was
  selected when it was made (`lib/canvas.ts`). It ships unlinked.
- It paints its own ring, so its box is transparent and borderless (`colors.ts`, `element-variant.ts`).
  `strokeColor` is the colour of the energy, not of a border.
- The link lives in **`ShapeElement.portalTarget`**, the id of the portal it leads to. Element ids are unique across a
  project, so no tab is stored; the tab is looked up.

## The name is menu-only

A portal has no caption on the canvas. Its name lives in the element menu and the picker. An unlabelled portal is named
**positionally**, "Portal 1", "Portal 2", in tab order (`portalName`); a typed name wins over the number.

## Linking

The element menu's **Portal** section (`components/palette/PortalMenuSection.tsx`, in `ElementDataSections`):

- **Name**: a text field, committed on blur or Enter.
- **Leads to**: every other portal in the project, this tab's first; one on another tab is labelled `Name · Tab`. The
  current target is marked, and picking it again unlinks.
- **Create Portal**: drops a second portal beside this one, already linked both ways, and selects it.

**A link is two-way.** Writing one side writes the other, and any third portal still claiming either end is released
(`usePortalSetters`, which sits off the style hook because a link commits across tabs). Resolution
(`resolvePortalTarget`, `resolvePortalDestination` in `lib/portals.ts`) honours an incoming link too, so a one-sided
pairing still resolves, and a target that was deleted, re-pointed at a non-portal or points at itself resolves to
unlinked rather than erroring. A duplicated or imported tab's links follow the new ids (`duplicate.ts`,
`useTabImport.ts`).

## Model and validation

`portalTarget` is validated as a non-empty string only. An id that doesn't resolve is not a structural error: a
project is edited in any order, and a half-wired portal is a normal intermediate state.

## Telemetry

`Element·Added·Portal` for Create Portal, `Element·Changed·Portal` for linking, unlinking and renaming
([Telemetry](../017-telemetry/telemetry.md)).

## Testing

`apps/editor/lib/portals.test.ts` (every way a link can break, positional names, cross-tab sites),
`packages/project/src/factories.test.ts` (portal-shaped and unpaired), `apps/editor/lib/canvas.test.ts` (its size).
