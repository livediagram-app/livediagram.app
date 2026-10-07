# Code block

A monospace, syntax-highlighted code snippet element in the palette's **Components** category ([Palette top-level categories and bands](../010-palette/palette-top-level-categories.md)). The audience is technical (Technology icons, architecture/sequence/class/state templates, the MCP server, Mermaid import); without it, people fake snippets with text elements.

## Model: a data shape, not a new element kind

`ShapeKind` includes **`code-block`** (the [Timeline rail](timeline-rail.md) "data shape" route), with two optional fields on `ShapeElement`:

```ts
code?: string; // the snippet, capped at 4000 chars in validate.ts
codeLanguage?: CodeLanguage; // closed set below, defaults to 'plain'
```

`CodeLanguage = 'plain' | 'ts' | 'js' | 'python' | 'json' | 'bash' | 'sql' | 'html' | 'css' | 'yaml'` (exported from `packages/document`). Everything else is inherited from the shape path: palette tap-to-drop AND draw-to-size, selection, resize, rotation, lock, layers, duplicate, copy/paste, history, realtime sync, eraser. `code-block` joins the self-drawing set (`isSelfDrawingShape`) so it has no centred label editing.

## Visual treatment

A code block keeps a **fixed identity** regardless of theme, the way sticky notes stay amber: an editor-style card (rounded corners, subtle border), monospace text at a fixed size with preserved whitespace, content clipped to the card with padding, and a muted language badge in the top-right corner (hidden for `plain`). Theme switches never recolour it. Default size 320×180.

### Colour schemes

The card paints from a **scheme**, not from the element's colours: `codeTheme` (a `CodeThemeId` from `packages/document/src/code-themes.ts`), absent meaning `midnight` (`DEFAULT_CODE_THEME`), the dark card. Eight ship: Midnight, Graphite, Ocean, Forest, Plum, Contrast, then the two light ones, Paper and Parchment. Each entry holds every colour of a card, surface / border / text / muted plus the four token colours, so the canvas view, the headless render and the preset tiles cannot drift.

`supportsColours` returns **false** for a code block, so the Colours and Border categories don't appear on one: the card ignores fill and stroke, so every swatch there would be inert while still writing to the element, autosaving, logging a change and broadcasting an op. The Style band opens for a code block carrying a **Presets** grid of the schemes instead, on the same hover-preview / click-commit flow as every other preset ([Style presets](../010-palette/style-presets.md)).

A single fixed look is right about where the colours come from and wrong about how many there are: a block on a light, warm board would be a hole in it, and a fill swatch would "fix" that by letting you paint the card pink and leave the syntax colours unreadable on it. A closed set of complete schemes is the only version of the choice that can't produce an unreadable card.

Scheme ids are stored on elements, so they are permanent: a `name` may be reworded, an `id` never. An unknown id still renders (the resolver falls back to the default) but fails validation, so it can't be written.

Empty blocks render a muted `// double-click to add code` placeholder line.

### Wrapping

`codeWrap`, absent meaning **true**: a line longer than the card wraps instead
of running off it. The card is usually narrower than the code someone pastes
into it, and a line running off the edge reads as truncated content rather than
a styling choice. Wrapping breaks mid-token as well as on spaces, because code
has long unbroken runs (a URL, a minified line) that word-wrapping alone leaves
hanging over the edge. A **Wrap Long Lines** toggle in the menu's Code section
turns it off for the block whose lines mean something at their full length.

The headless render wraps too (word-first, mid-token as a fallback), so a
shared thumbnail shows the same amount of code the canvas does.

## Syntax highlighting: lazy, hand-rolled, dependency-free

- A small generic tokenizer lives in `apps/live/lib/code-tokens.ts`: one engine (comments, strings, numbers, keywords, punctuation) driven by a per-language config table. No dependency, no WASM.
- It loads as an **async chunk** on the icon-registry pattern (`apps/live/lib/code-highlight-registry.ts`: memoized dynamic import, `useSyncExternalStore` pair, sync lookup returning undefined pre-load). Until the chunk lands, the block renders plain monospace text — it degrades, never blanks. First paints that show no code block never pay for the tokenizer.
- Token classes map to the active scheme's colour set (keyword / string / comment / number / punctuation), independent of the app theme.

## Editing

- **Double-click** opens an **Edit code dialog** (`apps/live/components/dialogs/CodeEditDialog.tsx`): a monospace textarea (Tab inserts two spaces, never moves focus) plus a language dropdown. Save commits one history entry; read-only/locked gating as usual.
- The element context menu has a **Code** section (in `ElementDataSections.tsx`, inside the menu's Tools flyout, per the data-shape pattern): a summary of the line count and language, an "Edit code" row opening the same dialog, and a Wrap toggle. The language is chosen in the dialog only; the menu has no language picker.

## Headless render (share thumbnails, MCP, exports)

`svg-render` has a `code-block` branch (`svgCodeBlockShape`): the scheme's card + plain monospace `<text>` lines (clipped to the box, no highlighting — the tokenizer is deliberately a live-editor-only chunk, and un-highlighted mono is a faithful degrade for a thumbnail).

## Plumbing checklist (per the data-shape route)

`SHAPE_KINDS` + bounded field validation in `validate.ts`, colour defaults in `colors.ts`, kind label ("Code Block", title-cased by `elementKindLabel`), palette tile `tools:code-block` (Components category, favouritable, no letter shortcut), quick-connect excluded, the OpenAPI regen (`pnpm --filter @livediagram/api gen:openapi`), the MCP schema prose (built from `SHAPE_KINDS`, so no hand list), the AI-generate prompt vocabulary (excluded: the AI shouldn't emit code blocks unprompted), and the telemetry dashboard's TOOLS label set.

## Telemetry

`track('Element', 'Added', 'CodeBlock')` at the add handler.
