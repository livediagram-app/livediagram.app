# Ask UI blueprint

Derived from [Search and Ask](../search-and-ask.md) "The views" and "Ask": the way between the
knowledgebase's views, the surface Ask and AI Knowledge are drawn on, AI Settings and the Ask view, over the client
the [knowledge UI blueprint](knowledge-ui.md) describes. **Nothing here is verified in a browser.**

## The views

| Piece                             | File                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| the view in the address           | `lib/knowledge-ask/knowledge-view.ts`                                                              |
| the view as React state           | `lib/knowledge-ask/useKnowledgeView.ts`                                                            |
| the tabs                          | `components/chrome/KnowledgeViewTabs.tsx` ([page surface blueprint](page-surface.md) "The footer") |
| who is offered the views          | `components/ask/useKnowledgeViewsOffered.ts`                                                       |
| the view's host, the frame's mark | `components/ask/KnowledgeViewHost.tsx`                                                             |
| the surface a view is drawn on    | `components/ask/KnowledgeViewFrame.tsx`                                                            |

- **`KnowledgeView`** is `'pages' | 'ask' | 'ai' | 'connect'` (Connect: [its blueprint](mcp-connect-ui.md)). `knowledgeViewOf(search)` reads `?view=`; anything else is
  `pages`. `knowledgeViewHref(href, view)` sets or removes the parameter and keeps the path, the rest of the query
  (a share link's `s`) and the hash (`#t=<page>`).
- **Why the query and not the hash:** `useTabEntryEffects` rewrites the whole hash to `#t=<id>` whenever it is not
  exactly that, so a view kept there would be lost on the first load.
- **A link's address** is `useKnowledgeViewHref(activePageId)`: this path and query with the view set, at
  `#t=<the open page>`. It is built from the page's id, not the hash on show, which the editor writes a moment after
  a page opens. No component reads `window` while rendering.
- **`showKnowledgeView(view, { replace })`** is `history.pushState` (or `replaceState`) with the router's own state
  handed back, then a notify. `subscribeKnowledgeView` also hears `popstate`, so Back and Forward move the view.
  `useKnowledgeView()` is `useSyncExternalStore` over the two; on the server it is `pages`.
- **The way between the views** is the footer's four tabs, a `nav` named "Knowledgebase Views"
  ([page surface blueprint](page-surface.md) "The footer and the top row"). The corner card's switch and the
  phone's switch row are gone.
- **Offered** (`useKnowledgeViewsOffered`): `hydrated`, a `documentId`, `appChrome`, and none of `embedMode`,
  `zenMode`, `anyWelcomeOpen`, a `workbench`, a `sessionCommunity`, a `sessionTabScope`. Not offered, the tabs
  are not drawn and the host shows Pages whatever the address says.
- **The frame** is `fixed`, from the anchor's top (`data-knowledge-view-anchor`, a zero-height mark in the editor's
  column, `KnowledgeViewAnchor`) to the footer's top (`[data-editor-tabbar]`, measured with one `ResizeObserver`
  and the window's `resize`), at `--z-canvas-modal` (45): over the canvas, the page tree, the top row and an empty
  page's template start, under every dialog. It is a `region` named for its view and takes the focus when it opens.
  - `useEditorInert`: every child of the editor's column that holds a `data-region` (the canvas and its chrome) is
    made `inert` for as long as the frame shows, and given back after. The child that holds the footer is left
    live: its tabs are the way to another view. Dialogs, toasts and hover cards are portals outside the column.
  - `useModalGuard(true)`: the editor's window-level shortcut and paste listeners stand down, as behind a dialog.
  - `KnowledgeViewHeader` is the top row every view shares (`KnowledgeTopRow`, rank `view`): the view's name, its
    one line from `lg` up, its buttons, then Share and the account button in the row's slot.
- **Loading:** each view is `next/dynamic` with `ssr: false`, fetched when first shown, and so is the AI Settings
  dialog, fetched when first opened: the editor's first load carries the tabs, the host and the two small stores. A view's render crash stays
  in the `KnowledgeView` error area.

### Tests

`lib/knowledge-ask/knowledge-view.test.ts` (the address, the history entry, Back),
`components/chrome/KnowledgeViewTabs.test.tsx` (the links and `aria-current`, the plain and the modified press, each
case the views are not offered in) and `components/ask/KnowledgeViewHost.test.tsx` (the inert editor, the live
footer, the modal guard, the way back).

### Not known

- An approver's banner or the footer changing height while a view shows moves the frame's top on the next
  `ResizeObserver` turn, one frame late.
- `inert` is set on DOM the editor's components own. React does not write that attribute for them, so nothing
  fights over it; a column child mounted while a view shows is not made inert.

## AI Settings

| Piece                      | File                                     |
| -------------------------- | ---------------------------------------- |
| who may do what            | `lib/knowledge-ask/ask-rights.ts`        |
| the settings, read once    | `lib/knowledge-ask/ai-settings-store.ts` |
| the words                  | `lib/knowledge-ask/ai-settings-words.ts` |
| how a provider is named    | `lib/knowledge-ask/provider-words.ts`    |
| which AI, and the provider | `components/ask/AiProviderPicker.tsx`    |
| whether the dialog is open | `lib/knowledge-ask/ai-settings-open.ts`  |
| the session's slices       | `components/ask/useAskSession.ts`        |
| the dialog and its host    | `components/ask/AiSettingsDialog.tsx`    |
| the key's field            | `components/ask/AiKeyForm.tsx`           |
| the header button          | `components/ask/AiSettingsButton.tsx`    |

- **Where it is.** A dialog (`Dialog`, `md`, a sheet on a phone), drawn by the views' host (`AiSettingsHost`) and
  opened by `openAiSettings()`. Not a Settings category: `SETTINGS_CATEGORIES` is copied to liveworkspace.app by
  `settings-site-catalogue.test.ts`, where no knowledgebase is open, and every row there is a preference of the
  person. The platform's catalogue copy is unchanged.
- **`askRights({ can, isStructureReadOnly, accountUserId, offline })`** answers `askOff` (`'offline'`,
  `'signed-out'` or `null`) and four flags an Editor of the whole knowledgebase holds when it is not kept Offline:
  `manageAi`, `makePages`, `resolve`, `context`.
- **`aiSettingsStore`** holds `GET ai`'s answer per knowledgebase: `idle`, `loading`, `ready` or `failed`.
  `load(who, id)` asks once (concurrent asks share the request; a failure is asked again next time); `set(id,
settings)` takes a write's answer. It has no field a key could be put in.
- **The key.** `AiKeyForm`'s input is uncontrolled: `type="password"`, `autocomplete="off"` on it and its form,
  no spellcheck, marked for password managers to ignore. React state holds one boolean (whether anything is typed).
  On submit the value is read, the field is emptied and the boolean cleared before the request is made, then the
  string is handed to `apiSetKnowledgeAiKey` and dropped. A refusal is worded from its code and status alone
  (`aiSettingsFailureText`): `invalid_key`, `invalid_model`, `ask_unavailable` (the server keeps no key), 403, 429,
  else the action's own fallback.
- **States.** Loading: the dialog's body keeps its height (`min-h-[23rem]`) and the state line is empty. Failed
  read: an error callout with **Try Again**. No key: "No Key Yet", the field labelled for the provider ("Add a Claude Key", "Add an OpenAI Key"), **Save Key**.
  A key: "Key Ending 4f2a" (or "Key Added" when the route sends no ending), **Remove**, the field labelled
  "Replace the Key", **Replace**. Remove asks in a `ConfirmDialog` ("Remove the Key?").
- **Roles.** Without `manageAi` the field, Remove and the model's select are not drawn; the model shows as text and
  one line says only an Editor can change these (or, Offline, that there is no Ask).
- **Which AI** ([Search and Ask](../search-and-ask.md) "Built-in AI"). The first section: a `radiogroup` of two rows
  (`AiSourcePicker`, over the same `AiChoiceRows` the provider uses): **Built-In AI** with an "Included" pill, or,
  when `GET ai` says `builtIn: false`, "Not set up on this server." and unavailable; and **Your Own Key**. In use is
  Your Own Key when a key is saved or the server has no built-in AI, else Built-In AI. On Built-In AI the provider,
  key and model sections are not drawn and `BUILT_IN_NOTE` says what it is. Choosing Built-In AI with a key saved
  asks first ("Use Built-In AI Instead?", confirm **Use Built-In AI**) and removes the key. Without `manageAi` the
  choice is its name as text (`data-ai-source-name`).
- **The provider** ([Search and Ask](../search-and-ask.md) "Providers"). Shown on Your Own Key, **Provider**: a
  `radiogroup` of two bordered rows (`AiProviderPicker`), each a native radio (visually hidden; the row wears the
  focus ring), a generic mark (`ProviderSparkIcon`, `ProviderRingIcon`: Lucide's sparkle and circle-dot, never a
  company's logo) and the provider's name with one line under it. `picked` is the provider chosen here and not yet
  saved; the stored provider changes only when a key for the new one is saved (`apiSetKnowledgeAiKey(who, id,
provider, key)`).
  - No key saved: choosing the other row is at once.
  - A key saved: a `ConfirmDialog`, `replaceProviderTitle` ("Replace the Claude Key With an OpenAI Key?"), confirm
    **Choose Provider**. Then the state line reads "Claude Key Ending 4f2a, in Use Until This One Is Saved", the
    field is labelled "Add an OpenAI Key" with the placeholder `sk-...`, and Model says the new provider's most
    capable model is used until another is chosen. Choosing the stored provider again needs no question.
  - The key field is keyed on the provider (`key={provider}`), so a switch mounts an empty field: nothing typed for
    one provider is ever sent as the other's.
  - The key's heading names the provider ("Claude API Key", "OpenAI API Key"), as do where to make a key and who
    the team pays (`providerWords`, `teamPaysNote`); a refusal is worded for the provider the key was typed for.
  - Without `manageAi` the provider is its name as text.
- **Words.** "Your team's AI key" wherever it does not matter which provider it is (the no-AI state of Ask, the
  key note under AI Knowledge's Disagreements on a server with no built-in AI); "Uses built-in AI" or "Uses your
  team's key" (`aiInUseLine`) under Ask's field (with a key, Ask's becomes the Answer With picker) and in Describe to Set Up; the provider's name where a failure is the provider's own
  (`askFailureWords(kind, { manageAi, provider })`: "OpenAI Did Not Accept the Key"). The provider comes from the
  settings the view already read. No AI copy says liveknowledge is free or has no paid tier: built-in AI is
  "Included", with daily limits, and on its own key the team pays its provider for what it uses.
- **Telemetry:** `UI·Opened·AiSettings`, `UI·Added·AiKey`, `UI·Removed·AiKey`, `UI·Changed·AiModel`,
  `UI·Changed·AiProvider`. No value.

### Tests

`lib/knowledge-ask/ask-rights.test.ts` (each role, signed out, Offline, a page-scoped link) and
`components/ask/AiSettingsDialog.test.tsx`: the state line, the field's attributes, the field cleared while the
request is out and after a refusal, the key absent from the DOM, the store, both browser stores, telemetry and the
console after a save, Remove with its question, the model, and the controls per role.

## Ask

| Piece                                             | File                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| one conversation, outside React                   | `lib/knowledge-ask/ask-conversation.ts`                                                   |
| the conversations and recent questions of the tab | `lib/knowledge-ask/ask-session-store.ts`                                                  |
| recent questions in `localStorage`                | `lib/knowledge-ask/recent-questions.ts`                                                   |
| an answer as parts, a passage's marks, Markdown   | `lib/knowledge-ask/answer-parts.ts`                                                       |
| a finished answer's Markdown as blocks, and drawn | `lib/knowledge-ask/answer-blocks.ts`, `components/ask/AnswerBody.tsx`                     |
| the trust line                                    | `lib/knowledge-ask/ask-trust.ts`                                                          |
| a failure in words                                | `lib/knowledge-ask/ask-failure-words.ts`                                                  |
| a source card's last line                         | `lib/knowledge-ask/source-meta.ts`                                                        |
| a page from an answer or for a gap                | `lib/knowledge-ask/make-page.ts`                                                          |
| the view and its gates                            | `components/ask/AskView.tsx`, `AskStates.tsx`                                             |
| the conversation and Sources                      | `AskConversationPane.tsx`, `AskAnswerCard.tsx`, `AskSourcesRail.tsx`                      |
| the stream                                        | `StreamingAnswer.tsx`                                                                     |
| the field                                         | `AskComposer.tsx`                                                                         |
| chips, gaps, recents, the page picker             | `CitationChip.tsx`, `KnowledgeGapCard.tsx`, `RecentQuestions.tsx`, `PagePickerDialog.tsx` |
| Draft a Page, opening a page                      | `useDraftPage.ts`, `open-passage.ts`                                                      |

### The conversation

- **`createAskConversation({ send, frame, newId, onAsked, onEnded })`**. `AskTurnView` is a question with `status`
  (`streaming`, `done`, `stopped`, `failed`), `text`, `sources`, `notUsed`, `gaps`, `model`, `failure` and
  `feedback`. The turn list is replaced when a question is asked, when its answer ends, and on feedback; never while
  an answer streams.
- **`ask(question)`** trims; refuses an empty question, one over `ASK_MAX_QUESTION_CHARS`, a second while one
  streams, and an eleventh turn (`ASK_MAX_TURNS`). It sends `{ question, turns }` where `turns` are the earlier turns
  that ended `done` or `stopped` with text. **`askAgain(id)`** re-runs a failed turn in place. **`stop()`** aborts the
  request and keeps what arrived. **`reset()`** aborts and empties the list.
- **The stream.** A `delta` is appended to the live turn's string and one animation frame is asked for if none is
  pending. The frame hands every watcher (`watchStream`) the text since the last frame. `StreamingAnswer` is the
  watcher: one text node, `appendData` once a frame, then `onGrow` (the conversation keeps its foot in view while
  the person has not scrolled away from it, by an `IntersectionObserver` on a 1px foot). Before the first words it
  says "Reading the pages…". The stream is `aria-hidden`; a visually hidden status says "Answering." and "The answer
  is ready."
- **When it ends**, the card draws the answer's Markdown, formatted (`AnswerBody` over `answerBlocks(text, cited)`,
  `lib/knowledge-ask/answer-blocks.ts`). The Markdown is read by the article's own reader (`parseMarkdownBlocks`,
  the one a pasted or imported page goes through) and cut down to what an answer may show: paragraphs, headings
  (drawn as `h3` to `h5`, under the page's own), quotes, bulleted, numbered and to-do lists with their nesting, code
  blocks, rules and tables, with bold, italic, struck and inline code. A marker (`[2]`, `[1, 3]`) whose numbers are
  all among the sources becomes `CitationChip` buttons (named "Source 2: <page>") wherever it stands but in code;
  any other marker stays text (`answerParts`, per run).
- **Nothing is HTML.** Every piece is a React text node or an element `AnswerBody` makes: a tag the model wrote
  (`<img onerror>`, `<script>`) is the characters it was. **No link is drawn** (search-and-ask.md "No outside links
  in an answer"): a link `safeHref` reads as `http` or `https` is its words and then " (<address>)" as text (the
  address once, after the link's last run; not repeated when the words are the address). Any other link
  (`javascript:`, `data:`, `mailto:`, a relative path) is its words alone. The only pressable things in an answer are
  its citation chips. Tests: `answer-blocks.test.ts`, and `AnswerBody.test.tsx` with `[click here](https://evil.example)`.
- **Streaming is untouched.** While the answer streams it is still the one text node; the Markdown is read once,
  when the answer has ended (the card is memoised on its turn and `AnswerBody` on the text), never per token.
  Measured (`answer-blocks.test.ts`): a 40,000 character answer of dense Markdown is read in 27 ms of CPU, held
  under `cpuBudgetMs(100)`; 15,000 unclosed marks stay under `cpuBudgetMs(150)`.
- **`askConversationFor(who, documentId)`** keeps one conversation per person and knowledgebase in a module map (four
  at most; the oldest is reset and dropped), so the view can unmount and mount again around it. `onAsked` sends
  `UI·Used·AskQuestion` and remembers the question; `onEnded` re-reads the AI settings after `ask_unavailable`.

### Chats: kept, completed, deleted

- **Where they live.** This browser's `localStorage`, under the key recent questions always used,
  `liveknowledge:ask-recent:v1:<person>:<knowledgebase>` (`lib/knowledge-ask/recent-questions.ts`). A row is
  `{ question, askedAt, id?, turns?, completedAt? }`: a row from before chats has no `id` (its id is `asked:<askedAt>`,
  `chatIdOf`) and no turns, and pressing it asks the question again as new. Bounded: 50 chats and 1,500,000
  characters at most (`withChatSaved` drops the oldest first, never the one just saved). A streaming turn is saved
  as stopped with no text; the answer is saved when it ends.
- **`recentQuestionsStore`** (`ask-session-store.ts`): `save(who, doc, id, turns, now)` on `onAsked` and `onEnded`,
  `accept`, `reopen`, `remove`. The conversation has `chatId()` and `open(chatId, turns)`; `reset()` starts a new chat.
- **Accept Answer** is on the latest turn that ended `done` with text, while the chat is not completed
  (`AskAnswerCard` `onAccept`). It sets `completedAt`, sends `UI·Used·AskAccepted`, resets the conversation and
  focuses the field. A completed chat opens read only: a success callout with **Reopen** stands where the field was.
  Reopen clears `completedAt` and sends `UI·Used·AskReopened`.
- **Completed Questions** (`RecentQuestions.tsx`, `data-ask-completed`): after the dated groups, a heading button with
  `aria-expanded`, a chevron and the count, closed by default; completed chats newest accepted first. It sits in the
  folded list on a phone the same way.
- **Delete** is an icon button at each row's end (a `HoverCard`, "Delete"; on hover and focus, always on a coarse
  pointer), named `Delete “<question>”`. A `ConfirmDialog` "Delete This Question?" names the question and says "This
  cannot be undone."; confirm removes the row, sends `UI·Removed·AskChat` and, for the open chat, resets to a fresh
  field. AI Knowledge's counts are the server's and stay.

### Sources

`shown` is `{ turnId, lit }`: a pressed chip sets both; the lit card scrolls into view, takes the focus and wears a
brand ring for `BLOCK_HIT_MS` (1,600 ms). `markedParts(text, question)` marks words of the passage that begin with
one of the question's content words (three or more letters, not common, twelve at most; one regular expression of
escaped words, linear in the passage). A card is the number chip (none on a passage found but not used) and the
title; the breadcrumb (`pagePath`: the parents shorten, the page's own name always shows, `data-source-path`) and the
headings each on a line of their own; the passage; then, above a hairline, the trust line (`sourceTrust`,
`data-source-trust`): `TrustBadge` Verified (tick) or Review Due (amber), or a quiet slate "Never Verified" pill with
no tick, then the date and "by <name>" as whole pieces that wrap rather than cut (the verifier's name from the page's
own `knowledge.verifiedBy` through `useKnowledgePeople`; a person the editor cannot name is left out).
**Numbering** is the server's (search-and-ask.md "Source numbers"): 1..n in the order first cited. `openPassage` shows Pages as a history entry and calls `goToBlock`; a page that
has gone raises "That page is no longer in this knowledgebase."

### Pages made here

`makePage` builds the tab with the import's `importedPageTab` (Markdown read by `articleFromMarkdown`: text, with
http, https and mailto links only), marks it loaded and its layout this editor's to settle, and adds it with
`withPageAdded` through `commitTabs`, so the autosave stores it. A refusal of the tree (500 pages, depth) is its own
words. `saveAnswerAsPage` writes the answer without markers and `## Sources` with a page link for each cited page
still in the tab list. `draftPageForQuestion` writes `*Draft, Not Verified*`, `## <question>` (escaped) and the
draft. Telemetry: `Tab·Created·FromAnswer` and `FromGap`.

### States, in the conversation's place

| State             | When                                       | Shows                                                                                                                        |
| ----------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| loading           | the settings are being read                | the room held, a `status` named "Loading Ask"                                                                                |
| could not be read | `GET ai` failed                            | an error callout, **Try Again**                                                                                              |
| Offline           | `askOff === 'offline'`; no request is made | "No Ask in an Offline Knowledgebase", **Search the Pages**                                                                   |
| signed out        | `askOff === 'signed-out'`                  | "Sign In to Ask", **Sign In**, **Search the Pages**                                                                          |
| no AI             | `hasKey` and `builtIn` both false          | "Built-In AI Is Not Set Up Here"; **Open AI Settings** for an Editor, "which an Editor adds" otherwise; **Search the Pages** |
| ready, no turns   |                                            | "No Questions Yet"                                                                                                           |

`askFailureWords(kind, { manageAi })` maps `bad-key`, `no-credit`, `rate-limited`, `overloaded`,
`model-unavailable`, `refused`, `person-limit`, `knowledgebase-limit`, `question-too-long`, `no-question`,
`ask_unavailable`, `sign_in_required`, `network`, built-in AI's `built-in-unavailable`, `built-in-limit`,
`built-in-knowledgebase-limit`, `built-in-failed` and anything else to a title, a line and a step (`ai-settings`,
`ask-again`, `none`). On `provider: 'built-in'` a model's failure (`bad-key`, `overloaded`, `other`, ...) is "The
Built-In AI Could Not Answer". The server's own `message` is never shown. Under the field, with no key, `aiInUseLine` adds
"Uses built-in AI" (`data-ask-ai`).

### Which AI answers

[Search and Ask](../search-and-ask.md) "Choosing which AI answers".

- **The choice.** `lib/knowledge-ask/ask-ai-choice.ts`: `askAiChoiceStore` (`get`, `set`, `subscribe`) keeps
  `'built-in' | 'key'` per person and knowledgebase in `localStorage` under
  `liveknowledge:ask-ai:v1:<person>:<knowledgebase>` (a value it does not know, or storage that throws, reads as
  `key`). `askConversationFor` sends it with each question (`send` reads it at the moment of asking, so a follow-up
  takes the choice in force), and `useAskAiChoice(who, documentId)` reads it for the view.
- **The picker.** `components/ask/AskAiPicker.tsx`, drawn under the field in place of the quiet line once a key is
  set (`settings.hasKey`, and `settings.builtIn`: a server without built-in AI has nothing to choose): the shared
  `SegmentedToggle` named and led by "Answer With", **Built-In AI** ("Included with liveknowledge, with daily limits. Applies to your next question.") and
  `teamKeyLabel(settings)` ("Claude Fable 5.2 (Team Key)", from the model's label; "Team Key" when it is not
  listed), each with its hover card. A change sends `UI·Changed·AskAiBuiltIn` or `UI·Changed·AskAiKey`.
- **Which answered.** The `done` event's `provider` is kept on the turn (`AskTurnView.provider`); with a key set the
  answer card shows `answeredByLabel(turn, settings)` (`data-ask-answered-by`) at the end of its trust line.
- **The route** (`knowledge-ask-route.ts`) reads `body.ai`: `'built-in'` runs built-in AI whatever key is stored
  (an unreadable key included); anything else is today's path (the key when it opens, built-in AI with none).
- Tests: `ask-ai-choice.test.ts`, `AskView.test.tsx` (the picker, its persistence, the request's `ai`, the caption),
  `knowledge-ask-built-in.test.ts` (built-in chosen with a key set counts against built-in caps; key chosen uses the key).

### Share roles

| Action                                                    | Editor | Participant | Viewer |
| --------------------------------------------------------- | ------ | ----------- | ------ |
| Ask, Stop, Copy Answer, helpful and not helpful (account) | yes    | yes         | yes    |
| Save as Page, Draft a Page From What We Know              | yes    | no          | no     |
| Open AI Settings from a failure or the no-AI state        | yes    | no          | no     |
| Accept Answer, Reopen, Delete a chat (this browser)       | yes    | yes         | yes    |

Tests, a role at a time: `components/ask/AskView.test.tsx` ("when this session cannot ask", "the parts the pages do
not cover", "the answer footer", "a failure, in words with the next step").

### Measured

- **React renders while an answer streams: 0.** `AskView.test.tsx` "what a streaming answer costs": 2,000 pieces
  over 20 frames give 20 `appendData` calls and no commit of the view (React `Profiler`), in jsdom.
- **The conversation's own work:** 20,000 pieces over 1,000 frames take about 6.4 ms of processor time (three runs:
  6.3, 6.4, 6.6); the test's guard is 250 ms.
- **Marking a passage:** 200 runs over a 1,265 character passage and a five word question take about 11.4 ms
  (11.2, 11.3, 11.8); the guard is 400 ms.
- Not measured: a real browser's layout and paint of a long answer as it grows (`whitespace-pre-wrap` on one text
  node, laid out again each frame; an answer is bounded by the model's `max_tokens`, 16,000).

### Not built, or not known

- **Ask <owner> to Write It** is not drawn: no email route exists.
- **Markdown while an answer streams** still shows as the characters the model writes; it is formatted when the
  answer ends ("When it ends"). Formatting each finished block as it streams is not built.
- **The draft's Ask call** spends one of the person's 20 questions and, when the pages still do not cover the
  question, counts it again as asked under AI Knowledge.
- **Chats are kept in this browser only**: another browser or device does not see them. Feedback goes nowhere but
  telemetry's count.
- **Stop** ends the request from the browser; whether the Worker's model call ends with it depends on the request's
  signal reaching the room, which no test here holds.
- **Focus order below 1,024px** follows the page: questions, conversation, Sources.
