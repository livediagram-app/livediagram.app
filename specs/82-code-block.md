# 82 — Code block

A monospace, syntax-highlighted code snippet element for the palette's Tools section. The audience is technical (Technology icons, architecture/sequence/class/state templates, the MCP server, Mermaid import) and today people fake snippets with text elements.

## Model: a data shape, not a new element kind

`ShapeKind` gains **`code-block`** (the spec/51/53 "data shape" route), with two optional fields on `ShapeElement`:

```ts
code?: string; // the snippet, capped at 4000 chars in validate.ts
codeLanguage?: CodeLanguage; // closed set below, defaults to 'plain'
```

`CodeLanguage = 'plain' | 'ts' | 'js' | 'python' | 'json' | 'bash' | 'sql' | 'html' | 'css' | 'yaml'` (exported from `packages/diagram`). Everything else is inherited from the shape path: palette tap-to-drop AND draw-to-size, selection, resize, rotation, lock, groups, layers, duplicate, copy/paste, history, realtime sync, eraser. `code-block` joins the self-drawing set (`isSelfDrawingShape`) so it has no centred label editing.

## Visual treatment

A code block keeps a **fixed identity** regardless of theme, the way sticky notes stay amber: a dark editor-style card (deep slate background, rounded corners, subtle border), monospace text at a fixed size with preserved whitespace, content clipped to the card with padding, and a muted language badge in the top-right corner (hidden for `plain`). Theme switches never recolour it. Default size 320×180.

Empty blocks render a muted `// double-click to add code` placeholder line.

## Syntax highlighting: lazy, hand-rolled, dependency-free

- A small generic tokenizer lives in `apps/live/lib/code-tokens.ts`: one engine (comments, strings, numbers, keywords, punctuation) driven by a per-language config table. No dependency, no WASM.
- It loads as an **async chunk** on the icon-registry pattern (`apps/live/lib/code-highlight-registry.ts`: memoized dynamic import, `useSyncExternalStore` pair, sync lookup returning undefined pre-load). Until the chunk lands, the block renders plain monospace text — it degrades, never blanks. First paints that show no code block never pay for the tokenizer.
- Token classes map to a fixed dark-theme colour set (keyword / string / comment / number / punctuation), independent of the app theme.

## Editing

- **Double-click** opens an **Edit code dialog** (own component file): a monospace textarea (Tab inserts two spaces, never moves focus) plus a language dropdown. Save commits one history entry; read-only/locked gating as usual.
- The element context menu gains a **Code** section (in `ElementDataSections.tsx`, per the data-shape pattern): an "Edit code" row opening the same dialog, and a language picker.

## Headless render (share thumbnails, MCP, exports)

`svg-render` gains a `code-block` branch: the dark card + plain monospace `<text>` lines (clipped to the box, no highlighting — the tokenizer is deliberately a live-editor-only chunk, and un-highlighted mono is a faithful degrade for a thumbnail).

## Plumbing checklist (per the data-shape route)

`SHAPE_KINDS` + bounded field validation in `validate.ts`, colour defaults in `colors.ts`, kind label ("Code block"), palette tile `tools:code-block` (Tools section, favouritable, no letter shortcut), quick-connect excluded, the OpenAPI regen (`pnpm --filter @livediagram/api gen:openapi`), the MCP schema prose if it hand-lists kinds, the AI-generate prompt vocabulary (excluded for now — the AI shouldn't emit code blocks unprompted), and the telemetry dashboard's TOOLS label set.

## Telemetry

`track('Element', 'Added', 'CodeBlock')` at the add handler.
