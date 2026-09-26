# Help illustrations

Inline SVG figures for the help articles ([Help app](../../../../docs/specs/018-help/help-app.md)). SVG, never screenshots, so
they stay crisp, theme with the brand ramp, and add zero binary assets to the
static export.

## Layers

- **`primitives.tsx`** — the shared SVG kit. The only building blocks a scene
  should need: `Scene`, `Shape`, `Arrow`, `SelectionBox`, `Cursor`, `Avatar`,
  `Panel`, `Dialog`, `Button`, `Tabs`, `Menu`, `Tile`, `Label`, `TextBar`. Read
  the props in the file; they are fully typed.
- **`<area>.tsx`** — one file per help area, exporting named **scene**
  components (PascalCase) composed from the primitives. `canvas.tsx` is the
  worked exemplar; mirror its structure and density.
- **`../Figure.tsx`** — frames a scene in an "editor viewport" card with a
  caption. Globally registered in `mdx-components.tsx`, so MDX uses
  `<Figure caption="…"><Scene/></Figure>` without importing `Figure`.

## House style (non-negotiable)

- Colours via Tailwind classes only: `fill-white`, `fill-slate-{100..800}`,
  `stroke-slate-{200,300}`, `fill-/stroke-brand-{50..700}`. For distinct accent
  hues use `emerald` / `violet` / `amber` / `rose` / `teal` / `indigo` at
  `400`/`500`. Never hardcode hex.
- A scene returns `<Scene w={…} h={…}>…</Scene>`. Typical size 380-420 wide,
  170-240 tall. Keep label text ≥10 units so it stays legible when scaled down.
- Draw the **actual** surface the section describes: real panel titles, button
  labels, and menu items lifted from the article text. Use `Panel` / `Dialog` /
  `Menu` / `Tabs` / `Button` for chrome; `Shape` / `Arrow` / `Cursor` for the
  canvas. Raw `<rect>`/`<circle>`/`<path>`/`<text>` (with brand/slate classes)
  is fine for motifs the kit lacks (charts, stars, rings, sliders).
- Reuse a scene across articles when the same surface recurs; do not redraw it.

## Placing figures in MDX

- Add `import { SceneA, SceneB } from '@/components/illustrations/<area>';`
  after the existing imports.
- Insert `<Figure caption="…"><SceneA /></Figure>` immediately after the prose
  of a section that genuinely benefits (a concrete UI surface, a before/after,
  a spatial relationship). Skip purely conceptual or reference-only sections.
  Aim for 1-3 figures per article.
- Put the `<Figure>` on its own lines with a blank line before and after,
  between paragraphs. Never inside a list, `<Tip>`, `<Note>`, or `<FeatureGrid>`.
- Captions: one concise sentence, sentence case. No em dashes (use commas,
  colons, or parentheses).
