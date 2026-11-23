# Suggested edits on the page and in the Inbox

Blueprint for [ai-knowledge.md](../ai-knowledge.md) "On the page" and "In the owner's Inbox" (Work Tracker 1362). The
Inbox half is the platform's: [inbox.md](../../../../liveworkspace/docs/specs/004-index/blueprints/inbox.md) and
[one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md) "Suggested edits".

## Domain and naming

- A **suggested edit** (a suggestion) is an agent's change to one page: `replace` (a passage, `before`, to `after`) or
  `append` (`after` at the page's end). It waits in the room's `suggestions` table, 50 at most, 90 days at most.
- **Located**: its `before` was found once in the page's writing. **Missing**: found nowhere or in more than one place
  ("The page has changed since"). An append is always located, at the page's end.
- **Show in Page**: one suggestion drawn in the writing, the words that go struck and the words that arrive underlined.

## Behaviour and state

- **One read.** The page's Page Health read (`GET pages/<tab>/health?opened=1`, one a page open) carries the page's
  `suggestions` and the knowledgebase's `suggestionCounts` (by page, filtered to what the reader may see). There is
  no route of its own and no poll.
- **Live.** Suggest, accept and dismiss send the room a `page-suggestions` system op (`{tabIds}`, ids only); each open
  editor reads its open page's health again, once.
- **The view store** (`lib/knowledge/page-suggestions-view.ts`) holds the open page, its article flows, the marks,
  what the writing found, the open popover (id and anchor), Show in Page's suggestion, an address's asked id, the
  push count and what is busy. Outside React, as the Find bar's highlights are.
- **In the writing** (`lib/article/article-suggestion-plugin.ts`): decorations only, never a step. One walk over the
  writing's text and one search a suggestion when the marks or Show in Page change; every edit only maps them.
  Reading: a node decoration `suggestion-wash` on each top-level block the passage covers and a widget host (the
  margin marker) at the first; an append's marker sits at the end. Show in Page: inline `suggestion-del` over the
  words that go and `suggestion-ins` widgets for the words that arrive, from a word diff; the other suggestions step
  back while one is shown.
- **Finding the passage** (`lib/knowledge/suggestion-passage.ts`): `before` read as words with its Markdown marks set
  aside, matched in order against the writing's text with any whitespace between; found once or not at all.
- **The host** (`components/knowledge/suggestions/PageSuggestionsHost.tsx`), mounted once with the canvas chrome
  (never in an embed, zen or with the chrome hidden): hands marks to the writing, portals each marker, opens the
  popover (`SuggestionPopover`, the bottom sheet on a phone), Show in Page's bar (`SuggestionReviewBar`), reads health
  again on a push, and opens `#t=<page>&suggestion=<id>` centred, then drops `suggestion` from the hash.
- **The pill** (`SuggestedEditsPill`) beside the trust badge in the meta row, the **rail section**
  (`PageRailSuggestions`, the newest 5, before AI Context, with Review All in Insights opening Needs Attention at
  Suggested Edits) and the **tree dot** (an 8 px violet dot, from `suggestionCounts`).
- **Accept and Dismiss** call `POST suggestions/<id>/accept|dismiss`, take the suggestion out of the held health at once
  (`pageKnowledgeStore.dropSuggestion`), toast, and read the page's health again. A 404 is read as already decided.
  Accepting keeps the page's verified state ("Stays Verified").
- **The Inbox**: the room's outbox pushes each tab's pending suggestions with its collab push (triggers on
  `suggestions` write the tab's outbox key, schema step V40; `OUTBOX_OWED` arms the drain without counting an edit).
  `ownerId` is the page's owner, null for the knowledgebase's.

## Interfaces and contracts

- `PageHealthResponse.suggestions?: KnowledgeSuggestion[]`, `suggestionCounts?: Record<string, number>`.
- `PageSuggestionsOp = { kind: 'page-suggestions'; tabIds: string[] }`, a system op in `SYSTEM_OP_KINDS` and
  `WORKER_MUTATION_KINDS`.
- The accept route answers `404 suggestion_not_found` for a suggestion no longer waiting (the Inbox's "already
  answered"); dismiss of one is `204`.
- `CollabPush.suggestions` as `one-explorer-contracts.md` says; texts cut by `suggestionPushOf`.

## Security and trust

- Accept and dismiss are an Editor's of the whole knowledgebase alone (`grant.role === 'edit'`, no tab scope), never an
  agent's token. The editor mirrors it with `suggestionRights` and Insights' `acceptSuggestions`.
- Suggestion texts are drawn as text (`textContent`, React text), never as markup.
- A passage found in two places is never marked: the page is never marked in the wrong place.

## Performance and limits

- No new request: the health read carries both lists; a push costs one read an open editor.
- Typing maps decorations; it never searches. The search is one regex a suggestion over the page's text, bounded by
  `PASSAGE_WORDS_MAX` (4,000 words); the word diff by `WORD_DIFF_CELLS_MAX` (250,000 cells), past which the whole
  passage goes and the whole suggestion arrives. Both have time-budget tests.
- At most 50 suggestions a knowledgebase; the rail shows 5; the Inbox 100.
- The popover measures on open and on scroll or resize while open, one frame each.

## Presentation and UX

The Insights violet: the wash `#f5f3ff` with a dashed `#a78bfa` underline, the marker a 28 px `violet-700` disc
with a 4 px `violet-100` ring at -44 px, the popover 500 px; removed lines rose and struck, added lines blue and
underlined. Dark mode in `app/article-suggestions.css`.

## Accessibility

- The marker, pill and rail rows are buttons with names, `aria-haspopup="dialog"` and `aria-expanded`; the popover and
  sheet are `role="dialog"` named Suggested Edit; Escape closes the popover, then Show in Page.
- The tree dot is `aria-hidden`; the row's label says "N Suggested Edits".
- Removed and added lines carry "Removed:" and "Added:" for a screen reader, and differ by sign and strike.

## Testing

- `lib/knowledge/suggestion-passage.test.ts`: words, location, ambiguity, missing, time budgets, word diff.
- `lib/knowledge/suggestion-rights.test.ts`, `lib/knowledge-ask/ask-rights.test.ts`: share roles.
- `apps/api/src/routes/knowledge-suggestion-routes.test.ts`: Editor-only accept and dismiss, the health read per role,
  the 404 code. `apps/api/src/knowledge/suggestions-inbox.test.ts`: the push shape and cuts.
- `app/document/[id]/room-op-shape.test.ts`: the op's shape.

## Constants and configuration

`PASSAGE_WORDS_MAX` 4,000; `WORD_DIFF_CELLS_MAX` 250,000; `RAIL_SUGGESTIONS_MAX` 5; `SUGGESTION_POPOVER_WIDTH` 500;
`INBOX_SUGGESTION_TEXT_MAX` 2,000 (reason 500, agent 200).

## Not built

- The tree dot has no hover card of its own (the row's label and the page's pill name it), as the approval dot.
- Where the agent connected from ("through the liveknowledge MCP") is not stored, so the popover says who and when.
