# Suggestions blueprint

Derived from [Suggestions](../suggestions.md). Implementation detail only; the spec owns every design decision. The
writing's model is [Article pages](article-pages.md); share roles are
[Share roles](../../013-workspace/blueprints/share-roles.md); the agent write is
[Pages for agents](../../024-agents/blueprints/pages-for-agents.md).

## Domain and naming

| Term              | Identifier                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suggestion        | `ArticleSuggestion` `{ id, k, by, n, c?, at, ai?, g?, was? }`, `packages/document/src/article-suggestions.ts`                                                                 |
| Kind              | `ArticleSuggestionKind` `'ins' \| 'del' \| 'fmt'` on a run (`ArticleRun.sg`); `'ins' \| 'del'` on a text block (`ArticleParagraphBlock.sg`, `ArticleListBlock.sg`): its break |
| Run format        | `ArticleRunFormat` (`b i u s code sup sub href color hl`), `runFormatOf(run)`, `withRunFormat(run, format)`; a format change's `was`                                          |
| Decision          | `SuggestionDecision` `'accept' \| 'reject'`; `decide(s) => SuggestionDecision \| null` (null leaves it)                                                                       |
| Resolving         | `resolveArticleRuns(runs, decide)`, `resolveArticleSuggestions(flow, decide)` → `{ flow, decided }`                                                                           |
| Rejected view     | `rejectedArticleFlow(flow)` (memoised per flow object), `withArticlesRejected(tab)`; `acceptedArticleFlow(flow)`                                                              |
| Listing           | `articleSuggestionList(flow)` → `ArticleSuggestionEntry[]` (in the writing's order, one per id); `articleHasSuggestions(flow)`                                                |
| Suggestion rule   | `suggestionRuleHolds(before, after, by)`, the server's check of a Suggest Only Participant's writing                                                                          |
| Suggest Only      | `ReviewSettings` `{ links, people, agents }`, `parseReviewSettings`, `suggestOnlyFor(settings, { shareCode, collabKey })`, `packages/api-schema/src/review.ts`                |
| Agent write       | `suggestArticleWrite(before, after, author)` → `{ flow, suggested, direct, kept }`, `packages/edit-operations/src/pages/article-suggest.ts`                                   |
| Editor mark       | `suggestion` mark (`articleSchema`), attrs `{ id, k, by, n, c, at, ai, g, was }`; block attr `sg` on `paragraph` and `list_item`                                              |
| Suggesting        | `suggestTransaction(state, tr, author)` → `Transaction \| { refused: SuggestRefusal }`, `apps/editor/lib/article/article-suggest.ts`                                          |
| Deciding (editor) | `resolveSuggestionsTr(state, decide)` → `{ tr, decided, waiting }`, `apps/editor/lib/article/article-suggest-resolve.ts`                                                      |
| Mode store        | `article-suggest-store.ts`: `useSuggestMode()`, `setSuggestMode(mode)`, `useSuggestOnly()`, `setSuggestOnly(on)`, `suggestAuthorNow()`                                        |
| Surfaces          | `SuggestModeMenu` (`page-toolbar-mode.tsx`), `useSuggestionCard` (`useSuggestionCard.tsx`), `SuggestCommentButton.tsx`, `SuggestionsSection` (`components/dialogs/share/`)    |

## Data and persistence

- **Run**: `sg?: ArticleSuggestion`, parsed by `parseArticleSuggestion(v, 'run')`: `id` `isArticleId`, `k` in
  `ins del fmt`, `by` a string of 1 to `SUGGESTION_BY_MAX` (64), `n` trimmed to `SUGGESTION_NAME_MAX` (80), `c` a hex
  (`isArticleHex`), `at` a finite number (rounded), `ai: true`, `g` `isArticleId`, `was` (fmt only) parsed as run
  flags, a safe href and hex colours. Anything else drops the field, an unreadable `sg` the whole mark (the run stays).
  `sameFormat` compares `sg` by `sameJsonValue`, so neighbouring runs of one suggestion merge. A suggested run costs
  `SUGGESTION_RUN_COST` (64) characters of the block's budget beside its text, so a block of suggestions still fits a
  room frame.
- **Block**: `sg?: ArticleSuggestion` on a paragraph or list item, `k` `ins` or `del` only.
- **Rejected view**: runs: `ins` dropped, `del` kept without its mark, `fmt` given back `was` (every format flag
  replaced) without its mark. Blocks, in order: an `ins` break (rejected) or a `del` break (accepted) joins the block
  onto the last text block written before it (its runs appended, normalised, the earlier block's attributes kept);
  with no text block before it, an empty block is dropped and any other keeps its words without the mark. A table's
  cells resolve their runs the same way. `resolveArticleSuggestions` with every decision `reject` is the rejected
  view, with `accept` the accepted one.
- **Review settings** (`document.review`, a nullable TEXT column, schema step V9): JSON `{ links: string[], people:
{ key, name }[], agents: boolean, seen: { key, name, at }[] }`, each list bounded (`SUGGEST_ONLY_MAX_LINKS` 100,
  `SUGGEST_ONLY_MAX_PEOPLE` 200, `seen` 200 most recent). Read defensively (`parseReviewSettings`); absent is all off.

## Behaviour and state

### The model (`article-suggestions.ts`)

- `resolveArticleSuggestions(flow, decide)` resolves every run, then walks the blocks joining as above; answers the
  same flow object when nothing was decided (`decided === 0`).
- `articleSuggestionList(flow)`: one entry per id in first-seen order, its text the concatenation of its runs (a
  break's entry text empty), its block the first block it is in.
- `suggestionRuleHolds(before, after, by)`: `rejectedArticleFlow` of each, compared block by block with `note` and
  `nk` stripped from every run (`sameArticleValue`), must match; for every suggestion id in either whose author is
  not `by`, the entry (fields and text) must be the same in both; every id only in `after` must have author `by`, no
  `ai` and no `g`.

### The room

- `gateClientOp` is unchanged; `RoomParticipantWrites.applyArticleOp` passes `suggestBy` (the session's collab key)
  when `suggestOnlyFor(readReview(), session)`; `applyParticipantArticleOps(tab, flow, ops, { suggestBy })` then
  refuses `not-suggestion` when `suggestionRuleHolds` fails, which resyncs the sender.
- `applyContentOp` passes `{ marginComment: true }` for such a session: `applyParticipantOp` then takes an `add` of an
  `article-note` element whose `articleNote` is `comment`, `ARTICLE_NOTE_SIZE` square, and nothing else new.
- On a Participant's `hello` the room records `{ key, name }` in `seen` (only when new or renamed) and sends that
  socket a system op `{ kind: 'op', from: 'system', op: { kind: 'review', suggestOnly } }` (never sequenced or
  relayed; `review` is in `SYSTEM_OP_KINDS`, so the gate drops one from a client socket). `PUT /review` sends every
  Participant socket its own op again. A system op rather than a new server message kind, so the shared room client
  (`packages/workbench`) carries it unchanged.

### The routes

- `GET /api/documents/:id/review` (Editor): `{ review: ReviewSettings & { seen } }`. `PUT` (Editor) with
  `{ links, people, agents }`: parsed, bounded, stored, the room told; answers the stored settings. Anyone else `403`.
- Token reads (`ctx.token`) of `GET /api/documents/:id` and its tab route answer each tab through
  `withArticlesRejected`.

### The agent write (`submitPages`)

- `suggest = tokenId !== null && (request.article.as === 'suggestions' || review.agents)`. With it, after
  `applyArticleWrite`, the written article is replaced by `suggestArticleWrite(storedFlow, writtenFlow, author)` where
  `author = { by: 'agent:' + tokenId, n: token name or 'Assistant', at: now, ai: true, g: change id }`. The answer's
  lines add the counts; the article room frame carries `suggested: { n, count, g }`.
- `suggestArticleWrite`: rejected base blocks and written blocks matched by a Myers diff on each block's key (type,
  style, list kind and level, plain text); a replace hunk pairs its deleted and inserted text blocks in order (same
  type: words diffed; otherwise the old block's words deleted and break taken out, the new one's inserted and break
  put in). Words: tokens are runs of letters and digits, runs of spaces, and single other characters; a Myers diff on
  the tokens' text gives insertions (the written run's format) and deletions (the stored run's format); kept tokens
  whose format differs become a format change. A stored block holding anyone else's suggestion is kept as stored and
  counted in `kept`; non-text blocks and block attribute changes go in as written and are listed in `direct`.

### The editor

- `article-suggest-store.ts` holds the mode (`editing` / `suggesting`), `suggestOnly` (from the room's `review` op)
  and the author (`useRoomConnection` sets the pinned collab key, name and colour); `suggestAuthorNow()` is the author
  while suggesting. `useParticipantSession` passes `{ suggestBy, marginComment: true }` to `participantTabChange` on
  Suggest Only, and `resolveEditorCapabilities(level, { suggestOnly })` drops element text and Replace.
- `dispatchTransaction` (`article-view-mount.ts`): when `suggestAuthorNow()` is set and the transaction is local
  (`!article-remote`) and changes the doc, it is replaced by `suggestTransaction(...)`; a refusal announces the notice
  and applies nothing.
- `suggestTransaction` walks the transaction's steps, mapping each through the steps before it
  (each earlier step map inverted in turn, since `Mapping.invert` ignores a slice's bounds, then the out
  transaction's own maps); steps are told apart by `toJSON().stepType`, as the editor reaches prosemirror-transform
  only through prosemirror-state:
  - `ReplaceStep(from, to, slice)`: text in the range that is the author's own insertion is deleted; anyone else's
    insertion, struck text and atoms are left; other text gets a `del` mark; each block start crossed gets
    `sg: del` (unless it is the author's own `ins` break, which is removed by joining). The slice, its suggestion marks
    stripped, goes in after the range with an `ins` mark (joining the author's adjacent insertion's id); a block
    starting inside the inserted range gets `sg: ins` and a fresh id from `blockIdsPlugin`.
  - `AddMarkStep` / `RemoveMarkStep` of a format mark: on the author's own insertion, applied as is; on struck text,
    nothing; else applied, with a `fmt` mark keeping the first `was`, dropped when the format is back to `was`.
  - A `note` or `suggestion` mark step is applied as is; an `AttrStep` of `id` or `sg` is applied as is. Any other
    step (`ReplaceAroundStep`, another `AttrStep`, a node's markup), or a slice holding a footnote or a block other
    than a paragraph or list item, refuses (`structure`). An undo or redo (`history$`), a collaborator's change
    (`article-remote`) and a decision (`article-suggest-pass`) pass as they are.
- `resolveSuggestionsTr`: from the end of the doc to its start, text with a decided mark: accept `ins` / reject `del` /
  accept `fmt` removes the mark; reject `ins` / accept `del` deletes the text; reject `fmt` puts `was` back. Blocks
  with a decided break: clears `sg`, or joins onto the text block before it (`tr.join`), or deletes an empty one.
  Suggestions in a block another person holds are left and counted in `waiting`.
- Decorations (`suggestBreaksPlugin`): a `¶` widget at the start of a block with `sg`, classed
  `article-sg-pilcrow-ins` / `-del` in the author's colour (`--sg-c`), carrying `data-sg-id` for the card.
- `blockIdsPlugin` also clears a duplicate break id: a split copies `sg` to the new half, and the break stays the
  first half's.
- The card (`useSuggestionCard`) opens on hover of `[data-sg-id]` or when a key or press leaves the caret in a
  suggestion (`suggestionAt`); its Accept / Reject / Accept All dispatch `resolveSuggestionsTr`. The mode menu
  (`page-toolbar-suggest.tsx`) reads the count only while open. `SuggestCommentButton` is a Suggest Only
  Participant's Comment (the toolbar is an Editor's); `useArticles.addNote` lets it through for `comment`.
- Viewer and presenting: `html[data-suggestions-hidden]` (set by `useParticipantSession` for `view`) and
  `html[data-presenting]` hide insertions and pilcrows and un-strike deletions (`article-pages.css`); a break
  suggestion keeps its two paragraphs on screen. Exports: `tabAsSeen` applies `withArticlesRejected`, and
  `pageWriting` sets an article whose writing shows suggestions from the headless estimate of the rejected tab.
- The toast (`useSuggestedToast`): an article op carrying `suggested` announces it; Review reveals the tab and
  `requestSuggestionReview(flow, g)`, kept until that article's card hook takes it.

## Interfaces and contracts

- System room op `{ kind: 'review'; suggestOnly: boolean }` (server to one socket, `from: 'system'`).
- Article room op gains `suggested?: { n: string; count: number; g: string }`.
- `ArticleWrite.as?: 'suggestions' | 'direct'`; MCP `write_article` and `update_document` take `as`; CLI
  `article set --as <suggestions|direct>`.

## Errors and edge cases

- A suggestion whose block another person holds waits (`waiting`), said by the notice.
- A Participant's frame that fails the rule is refused whole (`not-suggestion`) and resynced.
- A join with no text block before it keeps the block (words) or drops it (empty).
- IME composition while suggesting: each composition transaction is rewritten like typing; a browser that loses the
  composition when marks change ends the word early (the letters land).

## Security and trust

- Suggest Only is decided by the room from the session's verified share code and collab key, never the client.
- A Participant cannot accept, reject, edit or remove anyone else's suggestion, nor forge `ai` or `g`; names are
  display identity, as on presence.
- Agent reads never carry unaccepted text (token reads, agent views and Markdown are the rejected view).

## Performance and limits

- The rule costs two rejected views and a pass over the changed article per Participant frame (a 5,000-block
  article: tens of ms worst case, once per 600 ms commit).
- `rejectedArticleFlow` is memoised per flow object; `withArticlesRejected` answers the same tab when no article
  holds a suggestion (one scan of the runs).
- The agent's block diff is O((N+M)·D) on block keys and per block on tokens, bounded by the article's limits.

## Presentation and UX

- Insertion: `text-decoration: underline 2px var(--sg-color)` with a `color-mix` tint 14% of it behind; deletion:
  `line-through 1.5px var(--sg-color)`, the words at 60% ink; format: dotted underline. Active: tint 26%.
- Presenting and a Viewer (`html[data-presenting] .article-flow`, `.article-flow[data-sg-clean]`): insertions
  `display: none`, deletions and formats plain, `¶`s hidden.
- The card: the link card's surface, a 8 px dot, name (semibold), time (muted), the AI chip, the description, then
  Accept / Reject icon buttons (36 px, tooltips "Accept Suggestion", "Reject Suggestion") and "Accept All N".

## Accessibility

- Marks carry `data-sg` and a visually hidden prefix is not added (screen readers read the words as they show); the
  card is `role="dialog"` named "Suggestion by <name>", its buttons named. Colour is never the only signal (underline
  vs strike vs dotted, and the ¶).

## Observability

- `[participant-write] article refused { reason: 'not-suggestion' }`, `[review] saved { links, people, agents }`,
  `[pages-agent] suggested { count, kept, direct }`.

## Testing

| Rule                                                  | Test                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Rejected and accepted views, breaks join              | `packages/document/src/article-suggestions.test.ts`                                                         |
| The suggestion rule                                   | `packages/document/src/article-suggestions.test.ts` "suggestion rule"                                       |
| A Suggest Only Participant's frame refused or applied | `packages/document/src/participant-article.test.ts`, `apps/api/src/room-participant.test.ts`                |
| Review settings parsed, bounded, Editor-only routes   | `packages/api-schema/src/review.test.ts`, `apps/api/src/routes/review-route.test.ts`                        |
| Agent write as suggestions                            | `packages/edit-operations/src/pages/article-suggest.test.ts`, `apps/api/src/routes/tab-pages-route.test.ts` |
| Markdown is the rejected view                         | `packages/document/src/article-markdown.test.ts`                                                            |
| Suggesting transactions                               | `apps/editor/lib/article/article-suggest.test.ts`                                                           |
| Accept and reject in the editor                       | `apps/editor/lib/article/article-suggest.test.ts` "deciding suggestions"                                    |

## Constants and configuration

| Constant                  | Value | Why                                                        |
| ------------------------- | ----- | ---------------------------------------------------------- |
| `SUGGESTION_BY_MAX`       | 64    | A collab key (32 hex) or `agent:` and a token id           |
| `SUGGESTION_NAME_MAX`     | 80    | A display name as the roster shows it                      |
| `SUGGESTION_RUN_COST`     | 64    | A mark's stored fields, counted against the block's budget |
| `SUGGEST_ONLY_MAX_LINKS`  | 100   | Far past any document's Participant links                  |
| `SUGGEST_ONLY_MAX_PEOPLE` | 200   | Bounds the room row; the most recent joiners are kept      |
| `SUGGEST_NOTICE_MS`       | 3000  | The refusal notice at most this often                      |
| `SUGGESTION_QUOTE_MAX`    | 60    | The card's quoted text                                     |

## Defaults ledger

- The mode starts at Editing for every Editor, never remembered between sessions (the spec is silent on persistence).
- An assistant's name is its token's name, else "Assistant".
