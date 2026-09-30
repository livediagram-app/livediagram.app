# Code block: blueprint

Derived from [Code block](../code-block.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                         | Role                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `packages/diagram/src/data-shapes.ts`                        | `CODE_LANGUAGES`, `CodeLanguage`, `CODE_MAX_LENGTH`, `isCodeBlockShape`                       |
| `packages/diagram/src/code-themes.ts`                        | `CodeThemeId`, `CodeTheme`, `CODE_THEMES`, `DEFAULT_CODE_THEME`, `codeTheme`, `isCodeThemeId` |
| `packages/diagram/src/element-types.ts`                      | `code`, `codeLanguage`, `codeTheme`, `codeWrap`                                               |
| `packages/diagram/src/shape-factory.ts`                      | Size 320 × 180; seeds `codeLanguage: 'plain'`                                                 |
| `packages/diagram/src/colors.ts`                             | `supportsColours` false; `SELF_PAINTING_SHAPES` membership                                    |
| `packages/diagram/src/validate.ts`                           | Snippet length, closed language set, closed scheme ids                                        |
| `packages/diagram/src/svg-render-shapes.ts`                  | `svgCodeBlockShape`, `wrapLine`: the headless render                                          |
| `apps/live/lib/code-tokens.ts`                               | `tokenizeCode`: the lazy tokenizer chunk                                                      |
| `apps/live/lib/code-highlight-registry.ts`                   | `useCodeTokenizer`, `tokenizeLoaded`: memoised dynamic import                                 |
| `apps/live/components/canvas/CodeBlockView.tsx`              | Canvas card, badge, placeholder, highlighted lines                                            |
| `apps/live/components/dialogs/CodeEditDialog.tsx`            | Edit code dialog                                                                              |
| `apps/live/components/dialogs/EditorElementDialogs.tsx`      | Mounts the dialog for `codeEditOpenForId`                                                     |
| `apps/live/components/canvas/useBoxedElementGestures.ts`     | Double-click routes a code block to `onEditCode`                                              |
| `apps/live/components/palette/ElementDataSections.tsx`       | The Code section (Tools flyout)                                                               |
| `apps/live/components/palette/context-menu-data-editors.tsx` | `CodeSummary`: line count, language, Edit code, Wrap toggle                                   |
| `apps/live/components/palette/PresetSections.tsx`            | `CodeThemePresetsSection` in the Style band                                                   |
| `apps/live/lib/style-presets.ts`                             | `applyCodeThemeToEl`                                                                          |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`              | `setCodeSelected`, `setCodeWrapSelected`                                                      |
| `apps/live/hooks/canvas/useStylePreview.ts`                  | `previewCodeTheme`, `commitCodeTheme`                                                         |
| `apps/live/components/palette/palette-tile-defs.tsx`         | Tile `tools:code-block`, section `components`                                                 |
| `apps/api/src/ai-prompt.ts`                                  | The AI vocabulary, which omits `code-block`                                                   |

## Domain and naming

| Term        | Identifier                            | Meaning                                                          |
| ----------- | ------------------------------------- | ---------------------------------------------------------------- |
| Code block  | `ShapeKind` `'code-block'`            | The snippet card                                                 |
| Snippet     | `ShapeElement.code`                   | Up to `CODE_MAX_LENGTH` characters                               |
| Language    | `ShapeElement.codeLanguage`           | One of `CODE_LANGUAGES`; absent = `'plain'`                      |
| Scheme      | `ShapeElement.codeTheme: CodeThemeId` | The card's complete colour set; absent = `midnight`              |
| Wrap        | `ShapeElement.codeWrap`               | Long-line wrapping; absent = on                                  |
| Token       | `CodeToken = { kind, text }`          | `kind` in `plain \| keyword \| string \| comment \| number` [Q4] |
| Badge       | the top-right language text           | Hidden for `plain`                                               |
| Placeholder | `// double-click to add code`         | Shown for an empty or whitespace-only snippet                    |

Banned synonyms: "code theme" in UI copy (say colour scheme), "syntax theme", "snippet language".

## Behaviour and state

### Create

`createShape('code-block', x, y)`: 320 × 180, `codeLanguage: 'plain'`, no `code`. Telemetry
`track('Element', 'Added', 'CodeBlock')` (`SHAPE_TOKENS['code-block']`).

### Render (canvas)

1. `scheme = codeTheme(element.codeTheme)`; unknown or absent ids resolve to `midnight`.
2. Card: `rounded-lg` border in `scheme.border` on `scheme.surface`, `overflow-hidden`.
3. Badge when `language !== 'plain'`: 10 px mono, top 6 px, right 10 px, `scheme.muted`.
4. Body `pre`: 12 px mono, 16 px line height, 12 px padding. Wrap on: `whitespace-pre-wrap
break-all`; wrap off: `whitespace-pre` [G8].
5. Empty: the italic placeholder in `scheme.muted`.
6. Tokenizer not loaded: the snippet as plain text in `scheme.text` (degrade, never blank).
7. Loaded: one `div` per line, one `span` per token coloured from the scheme (`plain → text`,
   `keyword`, `string`, `comment`, `number`); an empty line renders a space.

### Tokenizer loading states

| State     | Condition                 | Render                                                      |
| --------- | ------------------------- | ----------------------------------------------------------- |
| `idle`    | no code block mounted yet | nothing loads                                               |
| `loading` | `loadPromise` pending     | plain text                                                  |
| `loaded`  | `tokenizer !== null`      | highlighted; listeners fire                                 |
| `failed`  | import rejected           | plain text; `loadPromise` cleared so the next mount retries |

### Tokenizer rules (`tokenizeCode`)

- CRLF normalised; split on `\n`. `plain` returns one plain token per non-empty line.
- Per language config: line comment, block comment pair, string quotes, keyword set,
  case-insensitive keywords (SQL), tag names (HTML).
- Block comments and backtick strings carry across lines; everything else resets per line.
- Numbers start with a digit or `.digit` and continue over `[0-9a-fA-FxX_.]`.
- Words are `[A-Za-z0-9_$-]` runs not starting with a digit; keyword or tag → `keyword`.
- Everything else is `plain`, one character at a time, merged with adjacent tokens of its kind.

### Edit

1. Double-click on the card calls `onEditCode(id)` before any label edit, unless
   `remotelyLocked`; read-only surfaces pass no handler. A user-locked block still opens [Q7].
2. The Code section (Tools flyout): `CodeSummary` ("No code yet" or "n lines · language"), an
   **Edit code** button opening the same dialog, and a **Wrap Long Lines** toggle
   (`setCodeWrapSelected`, `'CodeWrap'`). No language picker in the menu [Q5].
3. `CodeEditDialog`: a 14-row monospace textarea (`maxLength = CODE_MAX_LENGTH`, spellcheck off,
   autofocus) and a language `select` ("Plain text" for `plain`). Tab inserts two spaces at the
   caret and never moves focus [Q8]. Save commits `setCodeSelected(draft.slice(0, 4000), lang)`
   (one undo step, `'CodeBlock'`) and closes; Cancel, Close and Escape discard.
4. `setCodeSelected` writes to every selected code block, not only the one the dialog opened
   for [G7].
5. Style band: Colours and Border are absent (`supportsColours` false); **Presets** holds the
   eight schemes with hover preview and click commit (`'CodeTheme'`).

## Interfaces and contracts

```ts
export const CODE_LANGUAGES = [
  'plain',
  'ts',
  'js',
  'python',
  'json',
  'bash',
  'sql',
  'html',
  'css',
  'yaml',
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
export const CODE_MAX_LENGTH = 4000;
export type CodeThemeId =
  'midnight' | 'graphite' | 'ocean' | 'forest' | 'plum' | 'contrast' | 'paper' | 'parchment';
export function codeTheme(id: string | undefined): CodeTheme;
export function isCodeThemeId(id: string | undefined): id is CodeThemeId;
export function svgCodeBlockShape(el: BoxedElement & { type: 'shape' }): string;
// apps/live
export type CodeTokenKind = 'plain' | 'keyword' | 'string' | 'comment' | 'number';
export function tokenizeCode(code: string, language: CodeLanguage): CodeToken[][];
export function tokenizeLoaded(code: string, language: CodeLanguage): CodeToken[][] | undefined;
export function useCodeTokenizer(): boolean;
```

Validation rejections (`isValidElement` returns false): `code` not a string or longer than 4 000;
`codeLanguage` outside `CODE_LANGUAGES`; `codeTheme` failing `isCodeThemeId`. `codeWrap` is not
checked [G5]. Writers also truncate: the dialog `maxLength`, `save` and `setCodeSelected` slice
to 4 000.

## Data and persistence

| Field          | Class     | Absent means          |
| -------------- | --------- | --------------------- |
| `code`         | persisted | empty (placeholder)   |
| `codeLanguage` | persisted | `plain`               |
| `codeTheme`    | persisted | `midnight`            |
| `codeWrap`     | persisted | wrap on               |
| token arrays   | derived   | recomputed per render |

Scheme ids are permanent. An unknown stored id renders as `midnight` but cannot be written.

## Errors and edge cases

| #   | Case                            | Handling                                                                     |
| --- | ------------------------------- | ---------------------------------------------------------------------------- |
| E1  | Tokenizer chunk fails to load   | Plain text; `console.error` and a retry on the next mount                    |
| E2  | Snippet over 4 000 chars        | Truncated by every writer; rejected by validation                            |
| E3  | Unterminated block comment      | Comment to the end of the snippet                                            |
| E4  | Unterminated backtick string    | String carries to later lines                                                |
| E5  | Very long unbroken token        | Wrap on: broken anywhere (canvas), mid-token fallback (export) [G8]          |
| E6  | More lines than fit             | Clipped by the card on the canvas; export draws `floor((h - 24) / 16)` lines |
| E7  | Block deleted while dialog open | The dialog unmounts (element lookup fails)                                   |
| E8  | Read-only session               | No `onEditCode`, and the dialog never mounts when read-only                  |

## Security and trust

The snippet is untrusted text. The canvas renders it as React text nodes; the export escapes it
with `xmlEscape` inside `xml:space="preserve"` `<text>`. The language and scheme are closed sets
validated on write, so neither reaches markup as a free string. The tokenizer is linear in the
snippet length with no regular expression over the whole input.

## Performance and limits

`CODE_MAX_LENGTH` bounds the tokenizer to 4 000 characters per block, tokenised on every render
of a loaded block. The chunk is fetched once per page, only when a block mounts, so first paints
without a code block never pay for it. The dialog is lazy-loaded.

## Presentation and UX

- Fixed identity: theme switches never recolour it; eight schemes, dark first.
- Empty copy `// double-click to add code`; dialog title "Code", subtitle "Paste or type the
  snippet; pick a language for highlighting.", textarea placeholder `// your code here`.
- Palette: Components category, caption "Code", blurb "Syntax-highlighted code card", untinted
  tile. Kind label "Code Block".

## Accessibility

- Contrast: `text`, `keyword`, `string`, `number` meet 4.5:1 on every scheme; `muted` and
  `comment` fall below 4.5:1 on seven of eight (Paper 2.56:1, Plum comment 2.15:1) [Q9].
- The dialog has `ariaLabel="Edit code"`; the language control is a labelled native `select`.
- Keyboard: Tab never leaves the textarea, so Save is reachable only after Escape closes the
  dialog, which discards [Q8].
- The canvas card has no motion.

## Web experience

The tokenizer and dialog are separate chunks (LCP unaffected). The canvas card is canvas-space
(CLS 0). Highlighting re-renders once when the chunk lands.

## Observability

- `console.error('code tokenizer failed to load', err)` on a failed import, without a
  recognisable `[code-highlight]` prefix [G12].
- Telemetry: `Added CodeBlock`; `Changed CodeBlock | CodeWrap | CodeTheme`.

## Testing

| Rule                                            | Test                                               | File                                       |
| ----------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| Guard matches only `code-block`                 | code block matches only its own kind               | `packages/diagram/src/data-shapes.test.ts` |
| Bounded snippet, closed language set            | bounds the code block + checklist fields           | `packages/diagram/src/validate.test.ts`    |
| Every scheme complete, unique, default midnight | code themes cases                                  | `packages/diagram/src/code-themes.test.ts` |
| Unknown scheme falls back                       | falls back rather than returning undefined         | `packages/diagram/src/code-themes.test.ts` |
| Headless render: card, lines, badge             | renders a code block as the dark card + mono lines | `packages/diagram/src/svg-render.test.ts`  |
| Headless wraps word-first; off keeps one line   | code block wrapping cases                          | `packages/diagram/src/code-themes.test.ts` |
| Preset writes only the scheme                   | sets the scheme on a code block and nothing else   | `apps/live/lib/style-presets.test.ts`      |
| Tokenizer classes per language                  | none [G11]                                         |                                            |
| Degrades to plain until loaded                  | none [G11]                                         |                                            |
| Tab inserts two spaces; Save is one undo step   | none [G11]                                         |                                            |
| Double-click opens the dialog                   | none [G11]                                         |                                            |

## Constants and configuration

| Name                 | Value                       | Provenance / safe range                      |
| -------------------- | --------------------------- | -------------------------------------------- |
| `CODE_MAX_LENGTH`    | 4 000                       | Spec                                         |
| `CODE_LANGUAGES`     | 10 ids                      | Spec                                         |
| `DEFAULT_CODE_THEME` | `'midnight'`                | Spec                                         |
| `CODE_THEMES`        | 8 schemes × 8 colours       | Spec                                         |
| `CODE_FONT_SIZE`     | 12                          | Matches `text-xs` on the canvas              |
| `CODE_LINE_HEIGHT`   | 16                          | Matches `leading-4`                          |
| `CODE_PAD`           | 12                          | Matches `p-3`                                |
| Export char width    | 7.2 px per char             | Inline estimate in `svgCodeBlockShape` [G13] |
| Wrap word threshold  | a space past half the width | `wrapLine`                                   |
| Tab width            | 2 spaces                    | Spec                                         |
| Size                 | 320 × 180                   | Spec                                         |
