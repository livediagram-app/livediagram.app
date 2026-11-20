# Ask UI blueprint

Derived from [Search and Ask](../search-and-ask.md) "The three views" and "Ask": the switch between the
knowledgebase's views, the surface Ask and AI Knowledge are drawn on, AI Settings and the Ask view, over the client
the [knowledge UI blueprint](knowledge-ui.md) describes. **Nothing here is verified in a browser.**

## The three views

| Piece                                | File                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| the view in the address              | `lib/knowledge-ask/knowledge-view.ts`                                                              |
| the view as React state              | `lib/knowledge-ask/useKnowledgeView.ts`                                                            |
| the switch                           | `components/ask/KnowledgeViewSwitch.tsx`                                                           |
| who is offered the views             | `components/ask/useKnowledgeViewsOffered.ts`                                                       |
| the switch's places, the view's host | `components/ask/KnowledgeViewHost.tsx`                                                             |
| the surface a view is drawn on       | `components/ask/KnowledgeViewFrame.tsx`                                                            |
| the hook-ins                         | `editor-view-bars.tsx` (`leadAction`), `EditorView.tsx` (`KNOWLEDGE_SWITCH_ROW`, `KNOWLEDGE_VIEW`) |

- **`KnowledgeView`** is `'pages' | 'ask' | 'ai'`. `knowledgeViewOf(search)` reads `?view=`; anything else is
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
- **The switch** is a `nav` named "Knowledgebase Views" holding three links, each inside a `HoverCard` (its name and
  one line). The showing view has `aria-current="page"`. A plain left press moves in place and sends
  `UI·Opened·AskView`, `AiKnowledgeView` or `PagesView`; a press with a modifier or another button is the link's.
  The track is `slate-100` (`slate-800` dark) with 2px of padding; the showing segment is white (`slate-600` dark)
  with `shadow-sm`. Colour changes run on `duration-micro` under `motion-safe`.
  - `corner`: in `EditorCornerActions`' `leadAction` slot, segments 32px tall, the track the card's buttons' 36px.
    When the card goes compact (`data-compact`) the names become screen-reader text and the glyphs stay. Hidden on a
    phone (`phone:hidden`).
  - `row`: a phone's row in the editor's column, after the approver's banner and before the top row's layer, so the
    top row's card and the canvas chrome both start under it. Segments are 44px tall and share the width.
- **Offered** (`useKnowledgeViewsOffered`): `hydrated`, a `documentId`, `appChrome`, and none of `embedMode`,
  `zenMode`, `anyWelcomeOpen`, a `workbench`, a `sessionCommunity`, a `sessionTabScope`. Not offered, the switch
  draws nothing and the host shows Pages whatever the address says.
- **The frame** is `fixed`, from the anchor's top (`data-knowledge-view-anchor`, a zero-height mark after the phone
  row) to the window's foot, at `--z-canvas-modal` (45): over the canvas, the page tree, the toolbar and an empty
  page's template start, under the top row's layer (`--z-modal`) and every dialog. It is a `region` named for its
  view and takes the focus when it opens.
  - `useEditorInert`: every child of the editor's column that holds a `data-region` (the canvas, the bars) and not
    the top row's card is made `inert` for as long as the frame shows, and given back after. Children marked
    `data-knowledge-view-keep` (the phone row) are left alone. Dialogs, toasts and hover cards are portals outside
    the column.
  - `useModalGuard(true)`: the editor's window-level shortcut and paste listeners stand down, as behind a dialog.
  - `KnowledgeViewHeader` is 70px tall at least (the top row's 12px, 46px and 12px) and pads its right by the top
    row's card's measured width plus 12px (`useChromeBox`: one `ResizeObserver` on the card and on the column child
    above the anchor, and the window's `resize`), so its controls never sit under the card.
- **Loading:** each view is `next/dynamic` with `ssr: false`, fetched when first shown, and so is the AI Settings
  dialog, fetched when first opened: the editor's first load carries the switch, the host and the two small stores. A view's render crash stays
  in the `KnowledgeView` error area.

### Tests

`lib/knowledge-ask/knowledge-view.test.ts` (the address, the history entry, Back), and
`components/ask/KnowledgeViewHost.test.tsx` (the links and `aria-current`, the plain and the modified press, each
case the views are not offered in, the inert editor, the modal guard, the way back).

### Not known

- An approver's banner or the phone row changing height while a view shows moves the frame's top on the next
  `ResizeObserver` turn, one frame late.
- `inert` is set on DOM the editor's components own. React does not write that attribute for them, so nothing
  fights over it; a column child mounted while a view shows is not made inert.

## AI Settings

| Piece                      | File                                     |
| -------------------------- | ---------------------------------------- |
| who may do what            | `lib/knowledge-ask/ask-rights.ts`        |
| the settings, read once    | `lib/knowledge-ask/ai-settings-store.ts` |
| the words                  | `lib/knowledge-ask/ai-settings-words.ts` |
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
  read: an error callout with **Try Again**. No key: "No Key Yet", the field labelled "Add a Key", **Save Key**.
  A key: "Key Ending 4f2a" (or "Key Added" when the route sends no ending), **Remove**, the field labelled
  "Replace the Key", **Replace**. Remove asks in a `ConfirmDialog` ("Remove the Key?").
- **Roles.** Without `manageAi` the field, Remove and the model's select are not drawn; the model shows as text and
  one line says only an Editor can change these (or, Offline, that there is no Ask).
- **Telemetry:** `UI·Opened·AiSettings`, `UI·Added·AiKey`, `UI·Removed·AiKey`, `UI·Changed·AiModel`. No value.

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
- **When it ends**, the card draws `answerParts(text, cited)`: a marker (`[2]`, `[1, 3]`) whose numbers are all
  among the sources becomes `CitationChip` buttons (named "Source 2: <page>"); any other marker stays text. The
  paragraph is `whitespace-pre-wrap`; no element is ever made from the answer's own characters.
- **`askConversationFor(who, documentId)`** keeps one conversation per person and knowledgebase in a module map (four
  at most; the oldest is reset and dropped), so the view can unmount and mount again around it. `onAsked` sends
  `UI·Used·AskQuestion` and remembers the question; `onEnded` re-reads the AI settings after `ask_unavailable`.

### Sources

`shown` is `{ turnId, lit }`: a pressed chip sets both; the lit card scrolls into view, takes the focus and wears a
brand ring for `BLOCK_HIT_MS` (1,600 ms). `markedParts(text, question)` marks words of the passage that begin with
one of the question's content words (three or more letters, not common, twelve at most; one regular expression of
escaped words, linear in the passage). The last line is `pagePathText` (the page's ancestors from the tab list) and
`trustText` (the verifier's name from the page's own `knowledge.verifiedBy` through `useKnowledgePeople`; a person
the editor cannot name is left out). `openPassage` shows Pages as a history entry and calls `goToBlock`; a page that
has gone raises "That page is no longer in this knowledgebase."

### Pages made here

`makePage` builds the tab with the import's `importedPageTab` (Markdown read by `articleFromMarkdown`: text, with
http, https and mailto links only), marks it loaded and its layout this editor's to settle, and adds it with
`withPageAdded` through `commitTabs`, so the autosave stores it. A refusal of the tree (500 pages, depth) is its own
words. `saveAnswerAsPage` writes the answer without markers and `## Sources` with a page link for each cited page
still in the tab list. `draftPageForQuestion` writes `*Draft, Not Verified*`, `## <question>` (escaped) and the
draft. Telemetry: `Tab·Created·FromAnswer` and `FromGap`.

### States, in the conversation's place

| State             | When                                       | Shows                                                                                                                              |
| ----------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| loading           | the settings are being read                | the room held, a `status` named "Loading Ask"                                                                                      |
| could not be read | `GET ai` failed                            | an error callout, **Try Again**                                                                                                    |
| Offline           | `askOff === 'offline'`; no request is made | "No Ask in an Offline Knowledgebase", **Search the Pages**                                                                         |
| signed out        | `askOff === 'signed-out'`                  | "Sign In to Ask", **Sign In**, **Search the Pages**                                                                                |
| no key            | `hasKey` false                             | "Ask Needs Your Team's Claude Key"; **Open AI Settings** for an Editor, "Ask an Editor to add one" otherwise; **Search the Pages** |
| ready, no turns   |                                            | "No Questions Yet"                                                                                                                 |

`askFailureWords(kind, { manageAi })` maps `bad-key`, `no-credit`, `rate-limited`, `overloaded`,
`model-unavailable`, `refused`, `person-limit`, `knowledgebase-limit`, `question-too-long`, `no-question`,
`ask_unavailable`, `sign_in_required`, `network` and anything else to a title, a line and a step (`ai-settings`,
`ask-again`, `none`). The server's own `message` is never shown.

### Share roles

| Action                                                    | Editor | Participant | Viewer |
| --------------------------------------------------------- | ------ | ----------- | ------ |
| Ask, Stop, Copy Answer, helpful and not helpful (account) | yes    | yes         | yes    |
| Save as Page, Draft a Page From What We Know              | yes    | no          | no     |
| Open AI Settings from a failure or the no-key state       | yes    | no          | no     |

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
- **Markdown in an answer** (a list, bold) shows as the characters the model wrote.
- **The draft's Ask call** spends one of the person's 20 questions and, when the pages still do not cover the
  question, counts it again as asked under AI Knowledge.
- **A conversation is not kept across a reload**, and feedback goes nowhere but telemetry's count.
- **Stop** ends the request from the browser; whether the Worker's model call ends with it depends on the request's
  signal reaching the room, which no test here holds.
- **Focus order below 1,024px** follows the page: questions, conversation, Sources.
