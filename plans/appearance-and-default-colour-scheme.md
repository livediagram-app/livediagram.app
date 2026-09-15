# Appearance (light / dark / system) + the Default colour scheme

Two vocabulary changes and one behavioural merge, settled before any code was written:

| Thing                                       | Name              | Values / scope                                                      |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| The personal, per-browser chrome preference | **Appearance**    | Light / Dark / **System** — `localStorage`, never shared            |
| The per-tab canvas colours                  | **Colour scheme** | The 27-entry catalogue, stored on the tab, shared with every viewer |

**Persisted names stay as they are.** `Tab.theme`, the `theme` MCP parameter, the `Theme` telemetry
category and the `livediagram:v2:ui-mode` storage key are **data on the wire**, not vocabulary: renaming
them would need a D1 migration and would break saved diagrams and existing MCP callers for no user-visible
gain. The repo already does this (`slate` is the id of the Pink scheme). Code symbols follow the data
(`ThemeDefinition`, `getTheme`), UI copy and specs follow the user (`Colour scheme`). The one place both
meet — `packages/diagram/src/themes.ts` — says so in its header.

**Default resolves live, both halves** (the answer to "how deep does it follow Appearance"): a Default tab
bakes **no** element colours ever, and its backdrop re-resolves per viewer. Flip to dark and the canvas goes
charcoal; flip back and it's white again, with no write to the diagram. That is the only reading of "Default
shows Basic's colours in light and Charcoal's in dark" that survives a mode flip, and it is the first step
toward per-viewer colour schemes.

## 1. Appearance: rename the vocabulary

- [x] 1.1 `git mv` the three modules + the toggle to the Appearance name (`appearance-storage.ts`,
      `appearance-store.ts`, `useAppearance.ts`, `AppearanceToggle.tsx`), rename their exports, update
      importers. The storage KEY string is untouched — a rename there silently resets everyone's pick.

## 2. Appearance: the third option

- [x] 2.1 (test first) `appearance-store`: the stored value widens to `'light' | 'dark' | 'system'`, with a
      separate **resolved** `'light' | 'dark'` that consults `matchMedia('(prefers-color-scheme: dark)')`.
      Unknown / missing / legacy values still read as the documented default.
- [x] 2.2 (test first) While the stored value is `system`, an OS-level change re-applies the `.dark` class
      and notifies subscribers; while it is explicit, the OS is ignored.
- [x] 2.3 The pre-hydration script in `app/layout.tsx` resolves `system` too, or dark-mode users get a
      light flash on every load.
- [x] 2.4 The tab-bar control becomes a **cycle button**: Light → Dark → System → Light, one glyph
      (sun / moon / monitor), tooltip and `aria-label` naming the next state, telemetry gains `System`.

## 3. The Default colour scheme

- [x] 3.1 (test first) Catalogue: one `Default` entry with a light variant (today's Basic) and a dark
      variant (today's Charcoal). Id stays `brand`. `charcoal` stays **resolvable** so existing diagrams
      keep their look, but leaves the pickers.
- [x] 3.2 (test first) Resolution is appearance-aware: `getTheme('brand')` returns the variant matching the
      viewer's resolved appearance.
- [x] 3.3 Default leads the catalogue **and** the Dark category (`theme-order.ts`), labelled "Default" in
      both; each card previews the variant belonging to its slot.
- [x] 3.4 (test first) Default never bakes: applying it, resetting to it, and adding elements under it all
      leave element colours unset, in both appearances.
- [x] 3.5 (test first) A Default tab's backdrop re-resolves live while it is still on-theme; a hand-picked
      backdrop still wins.
- [x] 3.6 (test first) Unpainted elements take their default ink from the **canvas darkness**, so they read
      as Charcoal's greys on a dark canvas and today's brand blues on a light one.
- [x] 3.7 The chrome that reads the resolved scheme (canvas backdrop, palette tint, editor accent, tab
      pills) re-renders when the appearance changes — `React.memo` does not block context.
- [x] 3.8 The theme-match nudge and the picker's mode-switch row stop firing for Default, which by
      definition already matches.

## 4. Copy: Theme → Colour scheme

- [ ] 4.1 Editor UI strings (tab / canvas menus, the Canvas & Theme dialog, the pickers, the search
      commands, tooltips).
- [ ] 4.2 Help centre: the dark-mode article becomes the Appearance article (slug kept — it is a public
      URL), plus every article that names the control. Registry entries + keywords move with them.
- [ ] 4.3 Marketing copy that names the control.

## 5. Docs and specs

- [ ] 5.1 `specs/07-live-app.md` — the UI-mode section becomes Appearance, three values, cycle button.
- [ ] 5.2 `specs/09-canvas-and-palette.md` + `specs/14-new-diagram-route.md` — Default replaces Basic /
      Charcoal, counts move with it.
- [ ] 5.3 `specs/42-canvas-and-theme-dialog.md` + `specs/29-multicolour-themes.md` — vocabulary + counts.
- [ ] 5.4 `apps/mcp/src/schema.ts` — the theme blurb names `charcoal` as a dark preset.
- [ ] 5.5 `DECISIONS.md` (wire names stay), `AMBIGUITIES.md` (the default stays Light, not System),
      `LESSONS_LEARNED.md` if anything bites.

## 6. Proof

- [ ] 6.1 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
- [ ] 6.2 Drive the real editor: cycle all three appearances, confirm the Default canvas and its unpainted
      elements follow, confirm a Pink tab and a legacy Charcoal tab do **not**, confirm no write lands on
      the diagram when only the appearance changes.

## 7. Fold-back

- [ ] 7.1 Re-read every comment touched for plan coordinates ("task 3.6", "the merge") and rewrite them as
      domain statements. Confirm module headers describe what the module IS.
