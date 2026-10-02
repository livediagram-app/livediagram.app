# Explorer filters: blueprint

Derived from [Explorer filters](../explorer-filters.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

This part covers the pure module. The chips, the field, the routes and the telemetry emit follow with the Explorer
page and consume it unchanged.

Scope, by file (all under `packages/explorer-lens/src/`):

| File                                        | Role                                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/explorer-lens/src/dimensions.ts`  | The catalogue: dimensions, values, labels, telemetry types, constants                                     |
| `packages/explorer-lens/src/types.ts`       | `Lens`, `LensTerm`, `LensIssue`, `WordProblem`, `LensContext`, `LensSubject`, `LensSuggestion`            |
| `packages/explorer-lens/src/parse.ts`       | `parseLens`, `readWord`, `orderValues`, `tokenKeyOf`, `normaliseInput`, `emptyLens`                       |
| `packages/explorer-lens/src/serialise.ts`   | `serialiseLens`, `tokenOf`, `setDimension`, `setDimensionValues`, `toggleDimensionValue`, `removeTerm`    |
| `packages/explorer-lens/src/match.ts`       | `documentSubject`, `sharedSubject`, `compileLens`, `matchesLens`, `applyLens`, `editedCutoff`, `foldText` |
| `packages/explorer-lens/src/suggest.ts`     | `suggestTokens`, `acceptSuggestion`                                                                       |
| `packages/explorer-lens/src/view-models.ts` | `lensChips`, `lensPills`, `issueMessage`, `announceResults`                                               |
| `packages/explorer-lens/src/labels.ts`      | `valueLabel`, `valueOptions`: one source of labels for chips, pills and suggestions                       |
| `packages/explorer-lens/src/url.ts`         | `readLensQuery`, `withLensQuery`, `carryLensQuery`                                                        |
| `packages/explorer-lens/src/telemetry.ts`   | `selectedFacets`                                                                                          |
| `packages/explorer-lens/src/index.ts`       | The public surface (re-exports only)                                                                      |

## Domain and naming

| Term            | Identifier                                                | Meaning                                                                                 |
| --------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Lens            | `Lens` `{ text, filters }`                                | The one filter state; `filters[d]` is the list of `d`'s values, empty when unset        |
| Lens string     | `input` (functions), `q` (URL)                            | The lens written as words and tokens                                                    |
| Dimension       | `LensDimension`, `LENS_DIMENSIONS`                        | One closed axis: `opens-in`, `kind`, `template`, `made-by`, `edited`, `people`, `space` |
| Facet           | `LensFacet` = `'text' \| LensDimension`                   | A dimension or the text: what telemetry names                                           |
| Token           | `LensTerm` with `kind: 'token'`                           | A word `<key>:<values>` naming one or several values of one dimension                   |
| Value list      | `LensTerm.values`, `LENS_VALUE_SEPARATOR`                 | A token's values, comma-separated; they combine with or                                 |
| Text            | `LensTerm` with `kind: 'text'`, `Lens.text`               | Every other word                                                                        |
| Pending         | `LensTerm` with `kind: 'pending'`                         | A token-shaped word with a dimension key under the caret                                |
| Term state      | `TokenState`: `applied`, `inert`                          | Whether a token narrows the list; `inert` is a Space token on a scoped view             |
| Issue           | `LensIssue`, `LensIssueReason`                            | A named report about one term                                                           |
| Scope / view    | `LensView`: `aggregate` \| `scoped`                       | Whether the current view has a scope (breadcrumb)                                       |
| Subject         | `LensSubject`                                             | One listed row, reduced to what the lens reads                                          |
| Tab kind        | `kind` dimension, `KIND_VALUES`, `tabKind` on the summary | The first tab's kind at creation; only specific kinds are values                        |
| Template family | `template` dimension, `TEMPLATE_VALUES`, `templateFamily` | The template family a document was made from                                            |
| Suggestion      | `LensSuggestion`                                          | One autocomplete option with its replacement range                                      |
| Chip / pill     | `LensChip`, `LensPill`                                    | View models for the chip row and the field                                              |

Banned: "type" for an editor mode, a tab kind or a template family (they are Opens in, Kind, Template); "board" or
"board type" for a dimension ("board type" means a board outside the general diagram tab's environment, and is no
filter); "Generated" for made by AI; "query" for the lens (the URL parameter is the only `q`); "filter state" for the
lens.

## Grammar

Case-insensitive for keys and fixed values. `ws` is any run of Unicode whitespace (`\s`).

```ebnf
lens            = [ ws ] , [ word , { ws , word } ] , [ ws ] ;
word            = token | text ;
token           = key , ":" , value , { "," , value } ;  (* every value of the key's list *)
key             = "opens-in" | "kind" | "template" | "made-by" | "edited" | "people" | "space" ;
value           = opens-in-value | kind-value | template-value | made-by-value | edited-value | people-value
                | space-value ;
opens-in-value  = "diagram" | "draw" ;
kind-value      = "event-storming" ;
template-value  = "retrospective" | "kanban" ;
made-by-value   = "ai" ;
edited-value    = "today" | "7d" | "30d" | "12m" | "this-year" ;
people-value    = "me" | "others" ;
space-value     = "mine" | "shared" | "team:" , team-id ;
team-id         = idchar , { idchar } ;               (* no comma; must be one of the reader's teams *)
token-shaped    = letter , { letter | "-" } , ":" , { nonspace } ;
text            = nonspace , { nonspace } ;           (* any word that is not a token *)
```

Every value must belong to its key (`kind:draw` is no token). A repeated key joins its tokens' values. A word is **token-shaped** when it matches
`^[A-Za-z][A-Za-z-]*:` (`D41`); only token-shaped words can be reported.

## Behaviour and state

`parseLens(input, context, caret?)`:

1. **Cut.** When `input.length > LENS_MAX_INPUT_LENGTH`, keep the prefix up to the last whitespace at or before the
   limit (a single over-long word is cut at the limit, `D43`); issue `too_long` spanning the rest.
2. **Scan** the kept prefix word by word (`/\S+/g`), each with `start` and `end` offsets into `input`.
3. **Classify** each word with `readWord(word, context)`:
   - not token-shaped → text, no issue;
   - token-shaped, key not a dimension → text, `unknown_dimension`;
   - pending: `caret` given, `start ≤ caret ≤ end`, key a dimension → `pending`, no issue;
   - otherwise the value part is split on `,` and each entry read in turn; the first bad entry makes the whole word
     text with its reason: an empty entry (`kind:`, `edited:7d,`, `space:team:`) `missing_value`; an entry outside
     the key's list `unknown_value`; `team:<id>` with no team of that id (exact, case kept, `D53`) `unknown_team`;
   - every entry good → a token whose `values` are the entries written lower case (a team id keeps its case),
     deduplicated and in canonical order (`orderValues`).
4. **States.** A `space` token on a `scoped` view is `inert` with `space_not_here` (its `value` the comma list);
   every other token is `applied`.
5. **Lens.** `text` is the text words in order, as typed; `filters[d]` is the union of the values of `d`'s applied
   tokens, deduplicated, in canonical order: the catalogue order, and for space `mine`, `shared`, then teams by id
   in code-unit order, as the spec orders them. Unset is `[]`.
6. Issues come out ordered by `start`.

Invariants: every word yields exactly one term; a word is either applied, inert, pending or text; nothing is dropped
except the cut tail, which is always reported; repeating a dimension and listing its values give the same lens;
`parseLens` is pure and total (never throws).

`matchesLens(subject, lens, now)` is true when, for every set dimension, the subject's value is one of its values
(or), across dimensions (and), and every text word, folded (`D42`), is a substring of the folded name. A subject value
`null` (unknown) is in no list. `made-by` asks `madeByAi === true`. `edited` compares
`savedAt ≥ min(editedCutoff(v, now))` over its values, the widest of them:

| Value       | Cutoff                                                    |
| ----------- | --------------------------------------------------------- |
| `today`     | Local midnight of `now`                                   |
| `7d`        | `now − 7 × 86 400 000`                                    |
| `30d`       | `now − 30 × 86 400 000`                                   |
| `12m`       | `now` with its local calendar year moved back one (`D44`) |
| `this-year` | Local midnight on 1 January of `now`'s year               |

`documentSubject(summary, viewerId)`: `space` is `team:<teamId>` when the summary has a team, else `mine` (a document in
this browser included, as the spec decides); `people` is `me` when `ownerId === viewerId`; `madeByAi` is
`source !== null`; `opensIn`, `kind` (from `tabKind`) and `template` (from `templateFamily`) are the summary's values
when in their lists, else `null`, so the general diagram tab reads as no kind. `sharedSubject(item)`:
`space: 'shared'`, `people: 'others'`, `madeByAi`, `opensIn`, `kind` and `template` all `null`.

Serialising: `serialiseLens(lens)` writes one token per set dimension, `<key>:<v1>,<v2>…` in canonical value order,
in `LENS_DIMENSIONS` order, then the text words, joined by one space.
`serialiseLens(parseLens(serialiseLens(l)).lens) === serialiseLens(l)` for every lens.
`setDimension(input, dimension, values, context)` rewrites the word list: every token of `dimension` (any state)
leaves; when `values` is not empty one token with them in canonical order is written where the first stood, else after
the last token word, else first (`D54`); words join with one space. `setDimensionValues` is the same over strings read
from elsewhere, keeping only the dimension's own values. `toggleDimensionValue(input, dimension, value, context)`
reads the values every token of the dimension holds, adds the value or takes it away, and sets the result.
`removeTerm(input, term)` drops the term's span and collapses whitespace.

Suggestions: `suggestTokens(input, caret, context)` reads the **fragment**, the text from the start of the word
holding the caret up to the caret, and the **range**, the whole word:

- empty fragment → `[]`;
- no colon → one `dimension` suggestion per available dimension whose key starts with the lower-cased fragment;
  `insert` is `<key>:`;
- `<key>:<list>` with an available dimension → the list is split at the caret into the entries before the one under
  the caret, the typed start of that one, and the entries after it, empty entries dropped (`D56`). One `value`
  suggestion per value not already in the list whose value or label starts with the typed start, case-insensitive
  (`D47`); `insert` is `<key>:` with the earlier entries, the value and the later entries, comma-separated;
- any other fragment → `[]`.

Available dimensions exclude `space` on a scoped view. Values come in catalogue order; space offers `mine`,
`shared`, then teams by name A to Z (`D46`). At most `LENS_MAX_SUGGESTIONS`. A value suggestion's `matchesNothing` is
true when no subject matches the value **on its own**: the field without the word, with the dimension set to that
one value (`setDimensionValues`), every other dimension and word kept. A dimension suggestion's is false.

`acceptSuggestion(input, suggestion)`: a dimension suggestion splices `insert` over the range and puts the caret after
the colon. A value suggestion splices `insert` and one space over the range, trims the whitespace that followed the
word, and puts the caret after the space; the rest of the field is left as it is (`D48`).

## Interfaces and contracts

```ts
type LensView = 'aggregate' | 'scoped';
type LensTeam = { id: string; name: string };
type LensContext = { view: LensView; teams: readonly LensTeam[] };
type Lens = { text: readonly string[]; filters: { readonly [D in LensDimension]: readonly LensValueOf[D][] } };
type LensTerm =
  | { kind: 'text'; raw: string; start: number; end: number }
  | { kind: 'pending'; raw: string; start: number; end: number; dimension: LensDimension }
  | { kind: 'token'; raw: string; start: number; end: number; dimension: LensDimension; values: readonly string[]; state: TokenState };
type LensIssueReason =
  | 'unknown_dimension' | 'missing_value' | 'unknown_value' | 'unknown_team'
  | 'space_not_here' | 'too_long';
type Span = { raw: string; start: number; end: number };
type LensIssue = // a reason about one dimension names it; the other two name none
  | (Span & { reason: 'unknown_dimension' | 'too_long'; dimension: null; value: null })
  | (Span & { reason: DimensionIssueReason; dimension: LensDimension; value: string | null });
type ParsedLens = { lens: Lens; terms: readonly LensTerm[]; issues: readonly LensIssue[] };

parseLens(input: string, context: LensContext, caret?: number): ParsedLens;
readWord(word: string, context: LensContext): WordReading; // { kind: 'token', dimension, values } | { kind: 'text', problem }
orderValues(dimension: LensDimension, values: readonly string[]): string[];
serialiseLens(lens: Lens): string;
setDimension<D>(input: string, dimension: D, values: readonly LensValueOf[D][], context: LensContext): string;
setDimensionValues(input: string, dimension: LensDimension, values: readonly string[], context: LensContext): string;
toggleDimensionValue<D>(input: string, dimension: D, value: LensValueOf[D], context: LensContext): string;
removeTerm(input: string, term: { start: number; end: number }): string;
applyLens<T extends LensSubject>(subjects: readonly T[], lens: Lens, now: number): T[];
matchesLens(subject: LensSubject, lens: Lens, now: number): boolean;
compileLens(lens: Lens, now: number): (subject: LensSubject) => boolean;
documentSubject(summary: LensDocumentSummary, viewerId: string): LensSubject;
sharedSubject(item: { name: string; savedAt: number }): LensSubject;
suggestTokens(input: string, caret: number, context: SuggestContext): LensSuggestion[];
acceptSuggestion(input: string, suggestion: LensSuggestion): { input: string; caret: number };
lensChips(parsed: ParsedLens, context: LensContext): LensChip[];
lensPills(parsed: ParsedLens, context: LensContext): LensPill[];
issueMessage(issue: LensIssue): string;
announceResults(shown: number, total: number): string;
readLensQuery(search: string): string;
withLensQuery(search: string, input: string): string;
carryLensQuery(input: string, from: LensView, to: LensView): string;
selectedFacets(previous: Lens, next: Lens): LensFacet[];
```

`SuggestContext` is `LensContext & { subjects: readonly LensSubject[]; now: number }`. `LensSuggestion` is
`{ id, kind: 'dimension' | 'value', dimension, value: string | null, insert, range: { start, end }, label,
dimensionLabel, name, matchesNothing }`. `name` is the option's accessible name: the label alone for a dimension,
"<label>, <dimension label>" for a value, plus ", no matches" when marked. `id` is `dimension:<key>` or `value:<token>`, unique within one list, for
`aria-activedescendant`. A `caret` outside `[0, input.length]` is clamped (`D51`).

`applyLens` takes subjects so one rule serves documents, shared rows and, later, Timeline events: the caller maps each
row with `documentSubject` / `sharedSubject` and keeps its row on the subject (`T extends LensSubject`).

## Data and persistence

- The lens string is the only state. It lives in the URL (`q`), **ephemeral**: never in local storage, preferences or
  the api. No migration.
- `readLensQuery` returns `q` or `''`; `withLensQuery` sets `q` to `normaliseInput(input)` and removes it when that is
  empty, keeping every other parameter in order; the result is `''` or starts with `?`.
- `carryLensQuery` returns `input` from an aggregate view to an aggregate view, else `''`.

## Errors and edge cases

| Case                                                                | Handling                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `colour:red`, `http://x`                                            | Text, `unknown_dimension`                                           |
| `10:30`, `:x`, `3d:x`                                               | Text, no issue (not token-shaped, `D41`)                            |
| `kind:`, `edited:7d,`, `people:me,,others`, `space:team:`           | Text, `missing_value`                                               |
| `template:mindmap`, `kind:diagram`, `edited:year`, `space:everyone` | Text, `unknown_value`                                               |
| `template:kanban,mindmap`                                           | Text, whole, `unknown_value` naming `mindmap`                       |
| `board:kanban`                                                      | Text, `unknown_dimension`: there is no Board dimension              |
| `space:team:<unknown id>`                                           | Text, `unknown_team`                                                |
| `Template:KANBAN`                                                   | Token `template:kanban`                                             |
| Two `template:` tokens, or a value listed twice                     | Values joined, each once (or)                                       |
| `edited:today,30d`                                                  | The widest: the last 30 days                                        |
| `space:` on a scoped view                                           | `inert`, `space_not_here`; kept in the string                       |
| Input over 512 characters                                           | Cut at a word boundary, `too_long`                                  |
| Empty or whitespace-only input                                      | The empty lens; no terms, no issues                                 |
| Unknown or retired `opensIn` / `tabKind` / `templateFamily`         | Subject `null`: matches no value, shown when the dimension is unset |
| A general diagram tab and `kind:event-storming`                     | Not matched: the general tab is no Kind value                       |
| `savedAt` in the future                                             | Counts as edited for every value                                    |
| A shared row and `made-by:ai`                                       | Not matched (`madeByAi` unknown)                                    |
| Caret outside the input                                             | Clamped                                                             |
| Fragment `<unknown key>:…`, or space when scoped                    | No suggestions                                                      |

## Security and trust

- `q` arrives from any link: untrusted. It is length-capped before scanning, never evaluated, never turned into a
  regular expression (matching is `String.includes` on folded text) and rendered as text.
- A `space:team:<id>` token applies only for a team in `context.teams`, the reader's own; a link cannot probe whether
  another team exists, since every unknown id reads the same `unknown_team`.
- Labels show team **names** from the reader's own list; ids never reach a label, a message or telemetry.
- Nothing in the lens leaves the browser: no api call, and telemetry carries only a closed facet name.

## Performance and limits

- Parse is linear in the input, bounded by 512 characters (at most 256 words).
- `applyLens` compiles the lens once (cutoff, folded words) and folds each name once: `O(N × w)` for `N` subjects and
  `w` words. Budget: 5 000 subjects and 8 words under 5 ms on a mid-range laptop, well inside a 200 ms INP.
- `suggestTokens` runs at most 8 short-circuiting `some` passes: `≤ 8 × N` predicate calls per keystroke.

## Presentation and UX

Copy is the spec's, in one place (`view-models.ts`, labels in `labels.ts`):

- Value labels, dimension labels (a team the reader is not in reads "Unknown team"), the issue messages, and the announcement ("40 documents", "1 document",
  "12 of 40 documents", "No documents match").
- A pill reads `<Dimension>: <label>, <label>…`, except Made by AI, which reads "Made by AI". A muted pill's note is
  its issue message.
- Chips are `multiple` (a multi-select listbox) except Made by AI, a `toggle` named "Made by AI". A chip is named
  "Template: Retrospective, Kanban" when set and "Template, any" when not; its first option is "Any" (`value: null`),
  selected only when no value is, and every chosen value's option is selected.
- Value labels follow the product's names: "Event Storming" (`D57`); the Edited options read Today, Last 7 days, Last
  30 days, Last 12 months, This year, in that order (`D58`).
- The field stays one line high; pills and text scroll sideways inside it (`D50`).

## Accessibility

The view models carry every accessible name the spec lists: pill `name` ("Filter Template: Retrospective, Kanban",
plus ", not applied: <message>"), pill `removeName` ("Remove filter Template: Retrospective, Kanban"), chip `name`, option `name` ("Last 7 days, Edited",
plus ", no matches"), chip `control` deciding `aria-multiselectable` or `aria-pressed`, and `id`s fit for
`aria-activedescendant`. Roles, focus, contrast and target size are the page's,
as the spec states them.

## Web Experience

- The URL is written with `router.replace`, so typing adds no history entry and never reloads or refetches.
- Filtering is client-side over the already-loaded list: no request, no LCP change; the list re-renders in place
  inside the frame of an input event (INP).
- The one-line field (`D50`) and a filtered-empty state that takes the list's place keep CLS at zero.

## Observability

The module is pure: every decision is returned (term states, issues, `matchesNothing`), never swallowed. The page logs:

| Fingerprint                                                                  | Where                    |
| ---------------------------------------------------------------------------- | ------------------------ |
| `[explorer-lens] parsed terms=<n> applied=<facets> issues=<reasons or none>` | editor, debug, on settle |
| `[explorer-lens] url replaced view=<aggregate/scoped> empty=<bool>`          | editor, debug            |
| `[explorer-lens] carried from=<view> to=<view> kept=<bool>`                  | editor, debug            |
| `Explorer / Selected / <Facet>`                                              | telemetry                |

Never the words of the lens or a team id.

## Testing

Every test is pure, `< 10 ms`; coverage of `packages/explorer-lens/src` is 100 % (lines, branches, functions,
statements), enforced in the package's `vitest.config.ts`.

| Rule                                                         | Test                                             |
| ------------------------------------------------------------ | ------------------------------------------------ |
| Catalogue, labels, telemetry types closed and complete       | `packages/explorer-lens/src/dimensions.test.ts`  |
| Grammar, comma lists, repeats, every rejection, pending, cut | `packages/explorer-lens/src/parse.test.ts`       |
| Canonical comma form, round trip, chip writes and toggles    | `packages/explorer-lens/src/serialise.test.ts`   |
| Or within, and across, unknowns, cutoffs, text folding       | `packages/explorer-lens/src/match.test.ts`       |
| Dimensions, values, comma lists, marking alone, cap, accept  | `packages/explorer-lens/src/suggest.test.ts`     |
| Chips, pills, names, messages, announcement                  | `packages/explorer-lens/src/view-models.test.ts` |
| `q` read, write, removal, carry-over                         | `packages/explorer-lens/src/url.test.ts`         |
| Selected facets only when a value is gained                  | `packages/explorer-lens/src/telemetry.test.ts`   |
| The public surface                                           | `packages/explorer-lens/src/index.test.ts`       |

## Constants and configuration

| Constant                | Value | Provenance and safe range                                                                                                                       |
| ----------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `LENS_MAX_INPUT_LENGTH` | 512   | Every dimension with every fixed value takes under 200 characters; 512 leaves room for words and stays under 2 KB percent-encoded. 256 to 1 024 |
| `LENS_MAX_SUGGESTIONS`  | 8     | The longest fixed list is 5; 8 shows a page of teams without scrolling (`D52`). 6 to 12                                                         |
| `LENS_SETTLE_MS`        | 400   | "Once typing settles": past a typing gap, inside a second (`D49`). 250 to 800                                                                   |
| `LENS_VALUE_SEPARATOR`  | `,`   | The spec's comma list; no value or team id holds a comma. Fixed                                                                                 |
| `LENS_QUERY_PARAM`      | `q`   | The spec's URL parameter                                                                                                                        |

No environment variable or binding.

## Defaults ledger

D41 to D44, D46 to D54 and D56 to D58 in [DEFAULTS.md](DEFAULTS.md).
