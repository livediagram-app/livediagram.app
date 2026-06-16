# 44 — Custom themes

Users can build their own **themes**, save them to their account, reuse them across diagrams, and edit them later. A custom theme is the same shape as a built-in one ([spec/42](42-canvas-and-theme-dialog.md), [spec/29](29-multicolour-themes.md)), so once saved it behaves exactly like Forest or UML: pick it on a tab and new elements adopt its colours.

## Why

The catalogue ships a fixed set of themes. Teams want their own palette (brand colours, a house diagram style, a notation that isn't UML). Rather than widen the built-in list forever, let users author and store their own.

## Ownership + storage

- Custom themes are **owner-scoped**, exactly like diagrams and folders ([spec/11](11-api.md)): keyed by the request owner id, which is the Clerk `sub` for signed-in users or the `X-Owner-Id` guest id otherwise ([spec/04](04-auth-and-guest-access.md)). **Guests get them too** — consistent with the canvas-works-without-sign-in principle — and a guest who signs up carries them over via the existing `POST /api/migrate` owner-id remap.
- Stored in **D1** via the api worker (the browser never touches D1 directly). New table `custom_themes`:

  ```sql
  CREATE TABLE custom_themes (
    id          TEXT PRIMARY KEY,
    owner_id    TEXT NOT NULL,
    name        TEXT NOT NULL,
    definition  TEXT NOT NULL,   -- JSON: the themable payload (see below)
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE INDEX custom_themes_owner_idx ON custom_themes (owner_id);
  CREATE INDEX custom_themes_owner_created_idx ON custom_themes (owner_id, created_at DESC);
  ```

  (Migration `apps/api/migrations/00NN_custom_themes.sql`, applied by CI on deploy like every other migration — never run against prod by hand.)

- The theme **id** for a custom theme is `custom:<uuid>`. The `custom:` prefix keeps it from ever colliding with a built-in `ThemeId`, and makes "is this a custom theme?" a cheap string check. It is stored on `Tab.theme` like any other theme id, so a diagram referencing a custom theme round-trips with no special-casing in the diagram model.

## API

REST resource at `/api/custom-themes`, mirroring `/api/folders` one-for-one (same owner guard, same 400/403/404 conventions, same response envelopes):

- `GET /api/custom-themes` → `{ themes: CustomTheme[] }` — the owner's themes, newest first.
- `POST /api/custom-themes` `{ id, name, definition }` → `{ theme }` (201).
- `PUT /api/custom-themes/:id` `{ name?, definition? }` → `{ theme }` — owner-gated.
- `DELETE /api/custom-themes/:id` → 204 — owner-gated.

`CustomTheme` DTO (in `@livediagram/api-schema`):

```ts
export type CustomThemeDefinition = {
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  patternColor: string;
  backgroundOpacity?: number; // pattern opacity 0..1; absent = opaque
  elementFill: string | null;
  elementStroke: string | null;
  elementText: string | null;
  palette?: { fill: string; stroke: string; text: string }[];
  rootColor?: { fill: string; stroke: string; text: string };
  shapeColors?: Partial<Record<ShapeKind, { fill?: string; stroke?: string; text?: string }>>;
};

export type CustomTheme = {
  id: string; // "custom:<uuid>"
  ownerId: string;
  name: string;
  definition: CustomThemeDefinition;
  createdAt: number;
  updatedAt: number;
};
```

The `definition` is the **themable payload only** — it omits `id` / `label` (those live on the row) and the `extra` flag (custom themes are never "show more" gated). The api stores `definition` as a JSON string in the `definition` column and parses on read. `api-client` gains `apiListCustomThemes` / `apiCreate…` / `apiUpdate…` / `apiDeleteCustomTheme` in a new `lib/api/custom-themes.ts`, mirroring `lib/api/folders.ts` (deduped list, `apiHeaders` auth, `expectOk`).

## Making custom themes resolvable (`getTheme`)

`getTheme(id)` is synchronous and called all over the render path, so custom themes must resolve without an async hop. A module-level **registry** (`apps/live/lib/custom-theme-registry.ts`) holds `Map<id, ThemeDefinition>`. Resolution is split in two so callers can tell "the default theme" apart from "an id that names nothing":

```ts
// undefined when the id names nothing we know — a deleted custom theme,
// or one whose owner-scoped fetch hasn't landed yet.
export function resolveTheme(id: string | undefined): ThemeDefinition | undefined {
  if (id) {
    const custom = getCustomTheme(id);
    if (custom) return custom;
  }
  return THEMES.find((t) => t.id === id);
}

// Render path: always returns something.
export function getTheme(id: string | undefined): ThemeDefinition {
  return resolveTheme(id) ?? THEMES[0]!;
}
```

The split matters for **switching away from a deleted theme**. `setTheme` preserves user-customised element colours by diffing each field against the _previous_ theme's value. If the previous theme was a deleted custom one, diffing against `getTheme`'s default fallback would mistake the dead theme's colours for user overrides and silently recolour nothing — the tab reads as stuck. So `setTheme` uses `resolveTheme`: when the previous id is unresolvable it **hard-resets** every element to the newly-picked theme instead of preserve-customs.

A custom theme is materialised into a full `ThemeDefinition` (id = the `custom:` id, label = the saved name, plus the stored `definition` fields). The editor **fetches the owner's custom themes once on boot** (a `useCustomThemeRegistry(ownerId)` hook composed in `useEditorState`, fired after identity resolves) and registers them before the first tab render. Fetch failure is silent — diagrams fall back to built-ins. Because every existing `getTheme` caller is unchanged, custom themes flow through `recolourElementsForTheme` / `switchThemeElements` / `deriveNewBoxedColours` exactly like built-ins, including per-shape colours.

A React context (`CustomThemeProvider`) tracks the list reactively so the picker and Explorer update the instant a theme is created / edited / deleted in-session (it also writes through to the registry).

**Deleting an applied theme reverts the diagram.** When a custom theme is deleted, the provider invokes an `onThemeDeleted(id)` callback (supplied by the editor only — Explorer / new-diagram have no open diagram to repaint). The editor's handler (`resetTabsUsingTheme` in `useTabCanvas`) walks every tab in the open diagram and hard-resets any still pointing at the dead id back to the default theme — backdrop and element colours — so the deletion is visible immediately rather than stranding the old colours on a now-dead id. A diagram opened _later_ with a since-deleted theme id isn't auto-reverted (a non-owner viewing a shared diagram must never have their tab's theme silently rewritten); it renders via `getTheme`'s default fallback, and the next theme pick hard-resets it through the `resolveTheme` path above.

## Building a theme — Tab Appearance

The Theme tab of the Tab Appearance dialog ([spec/42](42-canvas-and-theme-dialog.md)) gains:

- A **Custom** category in the theme browse, sitting alongside the built-in colour categories. Its drill-in lists the owner's saved themes as cards (apply / edit / delete) plus a **+ New theme** card, with a short explainer line. (This replaced an earlier "My themes" row: presenting custom themes as just another category keeps the browse uniform.)
- **+ New theme** (or **Edit** on a saved card) opens the **theme builder** in place of the category grid, with a `Back` affordance.

The builder is **fast by default, deep on demand**:

1. **Start with three colours.** The top of the builder is three big swatches — **Base** (canvas background), **Fill** (element fill), **Stroke** (element outline) — plus a name field. From just these three we derive sensible defaults for everything else (text colour = a readable dark/light of the fill via `deriveTextColorForBg`; pattern colour = a tint of the stroke; pattern = grid), so a usable theme exists after three clicks.
2. **Customize details** (expandable) reveals the granular controls: **Text** colour, **Pattern** picker (the 14 `BackgroundPattern`s, reusing `CanvasStyleControls`' pattern grid) + **Pattern colour**.
3. **Per-shape colours** (expandable, advanced): a row per `ShapeKind` (its `ShapeIcon` + `elementKindLabel`) with fill / stroke / text swatches that, when set, populate `shapeColors[kind]` — this is how a user reproduces a UML-style "diamond is amber" theme of their own.

Colour inputs reuse the existing `ColorSwatch` (`palette-controls.tsx`); no new colour UI. A **live preview** (a small canvas of a few sample shapes) renders the in-progress definition via the same colour-resolution path the canvas uses, so the user sees the theme before saving. **Save** creates (or updates) via the api and registers it; the dialog then selects it on the active tab. Building / saving is gated to editable tabs only.

## Managing themes — Explorer

The Explorer ([spec/15](15-folders.md)) gains a **Themes** entry under its **Library** section (beside Image gallery):

- Route `/explorer/themes`; sidebar row with a palette glyph; `SelectedNode` gains `{ kind: 'themes' }`.
- The pane lists the owner's custom themes as cards (each a `ThemeSwatch` preview + name + element count), with **New theme**, **Edit** (opens the same builder, presented as a standalone modal here), **Duplicate**, and **Delete** (confirm) actions.
- Deleting a theme that a diagram still references is safe: `getTheme` falls back to the default, so the diagram keeps rendering (it just loses the custom look). No cascading rewrite.

## New-diagram / template picker

The New-diagram theme picker ([spec/14](14-new-diagram-route.md)) shows the same
**Custom** category and **+ New theme** builder as the Tab Appearance Theme tab,
so a user can apply (or author) one of their saved themes at the moment they
start a diagram. Both surfaces render one shared `CustomThemePicker` (which owns
the builder state and wires the custom category into `ThemeCategoryBrowser`), so
they can't drift. The `/new` route mounts its own `CustomThemeProvider`
(owner-scoped to the resolved self id) so the registry is populated there too;
the editor and Explorer already mount one. The chosen id (built-in or
`custom:<uuid>`) rides the existing template-create path (`onPick`,
`buildTemplatedTab`, `Tab.theme`), all widened from `ThemeId` to `string` for the
custom case.

## Telemetry

New `type`s on the existing `Theme` category ([spec/22](22-telemetry.md)): `track('Theme', 'Created', 'Custom')` on save-new, `track('Theme', 'Changed', 'CustomEdited')` on edit-save, `track('Theme', 'Deleted', 'Custom')` on delete. Applying a custom theme reuses the existing theme-pick event.

## Reuse notes

- DB / route / test layers copy the **folders** resource one-for-one (`db/custom-themes.ts`, `routes/custom-themes.ts`, `routes/custom-themes.test.ts`).
- `ColorSwatch`, `CanvasStyleControls` (pattern grid), `ShapeIcon`, `elementKindLabel`, `ThemeSwatch`, `tint`/`shade`/`deriveTextColorForBg` are all reused; the builder adds no parallel colour primitives.
- The builder component is shared between the Tab Appearance Theme tab and the Explorer edit modal (one `CustomThemeBuilder`, two hosts), so the two entry points can't drift.

## Out of scope (for now)

- Team-shared custom themes (a `team_id` column) — single-owner only for v1, like folders were before [spec/35](35-team-shared-diagrams.md).
- Importing / exporting a theme as a file.
- Editing a built-in theme (you can **duplicate-then-edit** by starting a new theme from the same colours, but the shipped catalogue is read-only).
