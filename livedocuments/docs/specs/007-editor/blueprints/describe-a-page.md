# Describe a Page: blueprint

How [Describe a Page](../describe-a-page.md) is built. One AI operation on Ask's rules, the layout catalogue the
agents use, and the same apply path as the MCP `change_pages` `layout` op and `write_article`.

## The api

- **Route**: `POST /api/page-drafts` (`apps/api/src/routes/page-drafts.ts`, `handlePageDrafts`), its shapes and
  refusal codes in `@livedocuments/api-schema` (`packages/api-schema/src/page-drafts.ts`: `PageDraftRequest`,
  `PageDraft`, `PageDraftResponse`, `PAGE_DRAFT_ERRORS`, `PAGE_DRAFT_PROMPT_MAX` = 500).
- **Who**: a signed-in person with `edit` on the document (`resolveDocumentGrant`, not trashed, a tab-scoped grant only
  for its own tab). A guest gets 403 `page_draft_needs_account`, anyone else without edit 403 `page_draft_forbidden`.
- **Which AI**: `openAiDraft` from `@liveworkspace/ask/server` (`packages/ask/src/server/ai-draft.ts`), the core the
  Send to Knowledge Base summary shares: the team's or the person's key first (`personAiKey`), else built-in AI on
  Ask's day (`spendAsk`, 30 a person a day), spent once for the whole draft. With Pro on, built-in AI spends
  `AI_CREDIT_COSTS.pageDraft` (1) after the answer, through `ai.charge`.
- **The asks** (`apps/api/src/page-drafts/page-draft-asks.ts`):
  - A slide or an infographic page takes two. `chooseLayoutRequest` lists the kind's catalogue (`draftCatalogue`, each
    layout's name, slots and sample words, built once per isolate from `layoutCatalogueFor` and `buildPageLayout` on a
    reference page) and asks for one name; `readLayoutChoice` reads it through `layoutNamed`, `{"layout":null}` as off
    topic. `fillLayoutRequest` then names that layout's slots with their samples and asks for the words;
    `readLayoutFill` keeps the layout's own slots only, trims lists to the slots' counts, cuts each text (400
    characters, 160 for a heading) and drops links to other sites.
  - An article or a flashcard takes one: `writePageRequest` asks for `{title, subtitle, markdown}`; `readWriting`
    writes the front matter and body, dropping pictures, HTML, zones and rules, cut at 12,000 characters.
- **Answer**: `{draft, provider, model}`, `draft` a `{kind:'layout', layout, label, text}` or a
  `{kind:'writing', markdown}`. Nothing is written to the document by the api: the editor makes the page, so it lands
  as the person's own edit and undoes as one.
- **Log**: `[page-draft] draft` with the answer, kind, layout, asks and time taken; never the words.

## The editor

- **Call**: `draftPage` (`apps/editor/lib/api/page-drafts.ts`) posts the request with the session's headers; an api
  refusal throws a `PageDraftRefusal` in its fixed words (a key's failure carried on `aiKey`), anything else a plain
  error.
- **The page edit**: `withDraftedPage` (`hooks/editor/page-draft-edit.ts`) is pure: it adds the next page as Add Page
  does (`pageAddedLike`, after the page here, its size and background carried), dresses it (`withDefaultPageBackgrounds`),
  then runs the engine's `applyPageChanges` with one `layout` op, or `applyArticleWrite` into the new page's article.
  It makes nothing at the page limit, for a kind the tab no longer holds, or on an engine refusal.
  `pageEdits().addDraftedPage` runs it on the newest tab inside `commitTabs` (so a peer's edit meanwhile is kept),
  then goes to the page, and puts the caret in a new article.
- **The engine** (`@livedocuments/edit-operations/pages`) is imported when the dialog opens, never with the editor.
- **Contents**: `usePageContents().expectAdded()` (packages/workbench) marks the page as here once it arrives, as Add
  Page does.
- **UI** (`components/canvas/describe-page/`): `DescribePageButton` (in `ContentsAddPage`, after Add Page, before
  `end`) hides for a guest (`useEditorAiScope().signedIn`) and without Add Page, so a Participant and a Viewer never see
  it; `DescribePageHost` (loaded once pressed) reads the chrome store and makes the page through a ref to the newest
  view; `DescribePageDialog` is the Describe family's dialog (`DescribePrompt`, `WorkbenchAiSource`,
  `HeroDialogHeader` with `describePageHeroArt`), a steady 352 px body, the slow line after 8 s, and an
  `AbortController` that Cancel, Escape and closing stop; `describe-page-words.ts` holds each kind's words.

## Tests

- `packages/ask/src/server/serve-summary.test.ts`: the shared core (`ai-draft.ts`)'s key, day, credit and failure
  paths.
- `apps/api/src/page-drafts/page-draft-asks.test.ts`, `apps/api/src/routes/page-drafts.test.ts`: the asks' readers and
  the route's roles, refusals and answers.
- `apps/editor/hooks/editor/page-draft-edit.test.ts`: every kind made, after the page here, on a peer's newer tab, and
  each refusal.
- `apps/editor/components/canvas/describe-page/*.test.tsx`, `lib/api/page-drafts.test.ts`: the button's roles and
  kinds, the host's request and toast, the dialog's busy, slow, refusal, failure and cancel states.
