# Code block

A monospace code snippet card (`shape: 'code-block'`). It is a model kind: no Plan surface places one, and it arrives
with a tab (an import, a paste, an agent's elements). The model, the element menu, the edit dialog and the export
render are in liveplanner; the canvas has no face for it (see [Elements](README.md)), so on a tab it shows as an empty
box with its selection ring while every export draws the card.

## Model: a data shape, not a new element kind

`ShapeKind` includes **`code-block`** (the [Timeline rail](timeline-rail.md) "data shape" route), with optional fields
on `ShapeElement` (`packages/project/src/element-types.ts`):

```ts
code?: string; // the snippet, at most CODE_MAX_LENGTH (4000) characters
codeLanguage?: CodeLanguage; // CODE_LANGUAGES, defaults to 'plain'
codeTheme?: CodeThemeId; // the card's scheme, absent meaning 'midnight'
codeWrap?: boolean; // absent meaning true
```

`CODE_LANGUAGES` (`data-shapes.ts`) is the closed set `plain`, `ts`, `js`, `python`, `json`, `bash`, `sql`, `html`,
`css`, `yaml`, wire-validated (`validate-shape.ts`) so a saved project can't smuggle an arbitrary string into the
renderer. A new block is 320 × 180 (`shape-factory.ts`). `code-block` is in the self-painting set, so it has no centred
label.

## Colour schemes

The card paints from a **scheme**, not from the element's colours: `codeTheme`, a `CodeThemeId` from
`@liveworkspace/model-core/code-themes`, absent meaning `midnight` (`DEFAULT_CODE_THEME`). Eight ship: Midnight,
Graphite, Ocean, Forest, Plum, Contrast, Paper and Parchment. Each entry holds every colour of a card (surface,
border, text, muted and the token colours), so the render and the preset tiles cannot drift.

`supportsColours` is **false** for a code block (`colors.ts`), so the element menu shows no Colours or Border category:
the card ignores fill and stroke. Its Style category carries a **Presets** grid of the schemes instead
(`CodeThemePresets`), on the same hover-preview, click-commit flow as every preset
([Style presets](../010-palette/style-presets.md)); `lib/style-presets.ts` applies one. A closed set of complete
schemes is the only version of the choice that can't produce an unreadable card.

Scheme ids are stored on elements, so they are permanent: a name may be reworded, an id never. An unknown id renders
(the resolver falls back to the default) but fails validation, so it can't be written.

## Wrapping

`codeWrap`, absent meaning **true**: a line longer than the card wraps instead of running off it, breaking mid-token
as well as on spaces, because code has long unbroken runs (a URL, a minified line). **Wrap Long Lines** in the menu's
Code category turns it off. The still render wraps too (word first, mid-token as a fallback).

## Editing

- **Double-click** (`EditorCanvasHost`, `useBoxedElementGestures`) or **Edit Code** in the menu opens the **Edit code
  dialog** (`components/dialogs/CodeEditDialog.tsx`): a monospace textarea (Tab inserts two spaces; Shift+Tab moves focus back out as anywhere, and ⌘/Ctrl+Enter saves, so a keyboard is never trapped in the field; a hint under it says so where there is a keyboard) and a language dropdown. Save commits code and language together, one undo step
  (`useDataShapeSetters`); read-only and locked tabs can't open it.
- The element menu's **Code** category (`context-menu-data-editors.tsx`, in `ElementDataSections`) shows the line
  count and language, Edit Code, and Wrap Long Lines. The language is chosen in the dialog only.

## Export render

`svgCodeBlockShape` (`packages/project/src/svg-render-shapes.ts`) draws the scheme's card and plain monospace lines,
clipped to the box, with no highlighting: an un-highlighted card is a faithful picture for a thumbnail, an export and
the MCP's inline preview.

## Telemetry

An added block counts as `Element·Added·CodeBlock` (`lib/element-telemetry.ts`).

## Testing

`packages/project/src/code-themes.test.ts` (the schemes and the wrapped still render), `validate.test.ts` (the bounds).
