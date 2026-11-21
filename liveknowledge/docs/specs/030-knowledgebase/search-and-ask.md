# Search and Ask

Status: **Search is built, not yet verified in a browser** ([Build plan](../005-project-roadmap/build-plan.md) step 8;
[blueprint](blueprints/knowledge-ui.md)): the universal search panel with This Knowledgebase as its first group; its
field stands at the head of the page tree. Ask (step 9) is its own change.

## Search

Owner, 2026-11-20: the sidebar's search is the **universal search**, with this knowledgebase's results first.

- The search field at the head of the page tree, and Cmd or Ctrl K, open the universal search panel every
  liveworkspace editor has (Tools > Search…): one field over everything the person can reach. liveknowledge adds a
  source to it and puts that source first; it has no search dialog of its own.
- **This Knowledgebase** is always the first group: page titles first, then passages, each result showing the page,
  its breadcrumb, its verified state and the matching lines with the words marked. Enter on a result opens the page
  at the passage. While the field is empty the group lists the pages opened most recently (kept in this browser,
  eight a knowledgebase).
- Below it, in the panel's usual order: the person's other knowledgebases and items across the apps (the index),
  commands, settings and help. A result from this knowledgebase is never ranked below one from anywhere else, and
  the other groups never delay it: each source answers on its own and its group fills in when it does.
- Nothing matching in this knowledgebase shows the group with "No Pages Match" in one line, so it is clear the
  knowledgebase was searched, and the other groups follow.
- The index lives in the knowledgebase's Durable Object: an FTS5 table over each page's title and its writing split into
  **passages** (a heading and the blocks under it, at most 1,200 characters). The room rewrites a page's rows when
  its writing is saved, in the same transaction as the link table.
- Search needs no model and no key. It works for every role, signed in or through a share link, and Offline knowledgebases
  search in the browser over the same passages.
- **Bounds:** a query is at most 200 characters, returns at most 20 passages, and is rate-limited per caller. Indexing
  a save is linear in the page's length; a 100,000 character page must index within 50 ms of CPU (a test holds it).

## Ask

Ask answers a question in plain words from the knowledgebase's own pages, and says where each part came from.

- **Bring your own key.** Ask runs on the team's own key (Describe to Set Up also has built-in AI, describe-to-set-up.md): the team pays its provider for what it uses
  (Describe to Set Up alone has built-in AI, liveknowledge's, when there is no key). Ask is
  offered once an Editor adds the knowledgebase's own key, Claude's or OpenAI's ([Providers](#providers)), in
  **AI Settings**. Without a key the Ask tab explains this with one button to AI Settings, and
  search still works.
- **The key** is sent once over TLS to the api, encrypted with AES-GCM under the Worker's `AI_KEY_SECRET`, and kept in
  the knowledgebase's Durable Object. It is never sent back to any client: AI Settings shows only "Key Ending 4f2a", **Replace**
  and **Remove**. Logs and telemetry never hold it. A knowledgebase kept Offline has no Ask.
- **Model:** Claude, `claude-fable-5-2` by default; AI Settings offers the current Claude models, since the team
  pays for what it uses.
- **Answering:** the api takes the question, finds the best passages with the search index (up to 12, verified pages
  first), and asks the model to answer only from them, citing each claim. The answer streams to the page.
- **What an answer shows:** the answer with numbered citations; a **Sources** rail with each cited passage, its page
  and who verified it when; a trust line ("Answered From 3 Verified Pages", or how many were unverified or due);
  **Found but Not Used** for a passage set aside because it is stale and disagrees with a newer verified one.
- **It does not guess.** The model is told to say so when the passages do not answer the question or part of it. That
  part is recorded as an unanswered question ([AI Knowledge](ai-knowledge.md)) and shown as a **Knowledge Gap** card
  with **Draft a Page From What We Know** and, once it has an email of its own (the review emails are built; this
  one is not), **Ask <owner> to Write It**.
- **Scope:** an answer reads only pages the asker can open. A follow-up keeps the conversation (up to 10 turns).
  Recent questions are kept per person, per knowledgebase, in the browser.
- **Bounds:** 20 questions a person an hour and 200 a knowledgebase a day (`ASK_*` limits, checked in the room); a question is at
  most 1,000 characters; the passages sent are capped at 24,000 characters. A failed or refused model call says
  which (bad key, no credit, rate limit) in words, never a raw error.

## Providers

Owner, 2026-11-20: a team may bring an **OpenAI** key instead of a Claude one. **Built** (the package, the api
and AI Settings; [blueprint](blueprints/knowledge-package.md) "Providers", "The OpenAI API"); no real model was
called for either provider, so the request and stream shapes are unverified against the live APIs.

- AI Settings asks for the **provider** first, **Anthropic (Claude)** or **OpenAI**, then the key and the model. A
  knowledgebase holds one provider and one key at a time; choosing the other provider replaces the key after a
  confirmation.
- Everything that uses a model runs on whichever is set, with the same behaviour, limits and words: Ask, the
  conflict check, drafting a page from a gap and [Describe to Set Up](describe-to-set-up.md) (which, alone, runs on
  built-in AI when no key is set: owner, 2026-11-21, [The model](describe-to-set-up.md#the-model)). The interface says
  "your team's AI key" wherever it does not matter which, and names the provider where it does (a refused key:
  "OpenAI Did Not Accept the Key").
- The key is sealed and kept exactly as a Claude key is, with its provider beside it. The api calls only the chosen
  provider's own API host, and never sends a key to the other.
- The models offered are each provider's current general models, a short list kept in the knowledge package and
  checked against the provider's documentation when it is built; the default is each provider's most capable.
- The prompts, the fenced passages, the citation markers and the answer's tagged shape are the same for both; only
  the request and stream formats differ, behind one interface in the knowledge package.
- **In AI Settings:** two bordered rows, each a generic mark and the provider's name as text (no company's logo).
  With no key saved, choosing the other provider is at once. With a key saved it asks first ("Replace the Claude
  Key With an OpenAI Key?"); the saved key then stays in use until a key for the new provider is saved, and that
  save replaces it and returns the model to the new provider's most capable. Removing a key keeps the provider.
- **The api:** `GET ai` answers `{ provider, hasKey, keyHint, model, models, providers }`; `PUT ai/key` takes
  `{ provider, key }` (no provider: the one already chosen); a model must be one of the stored provider's. A key
  stored before there was a choice reads as Anthropic's: the provider is one more row of the room's settings, and
  its absence is that answer, so no stored knowledgebase is changed.

## Share roles

| Action                                | Editor | Participant | Viewer |
| ------------------------------------- | ------ | ----------- | ------ |
| Search                                | yes    | yes         | yes    |
| Ask                                   | yes    | yes         | yes    |
| Add, replace or remove the key, model | yes    | no          | no     |
| Draft a page from a gap               | yes    | yes         | no     |

Ask through an anonymous share link is off: it would spend the team's key for strangers.

## The Ask view

- **Three columns** on a window at least 1,024px wide: the person's questions (**New Question**, then recent
  questions under Today, This Week and Earlier), the conversation with the question field at its foot, and
  **Sources**. Narrower, they stack in that order with the recent questions folded under a **Recent** button.
- **The conversation.** A question is a dark bubble at the right. An answer is a white bordered card that streams
  in, then shows numbered citation chips (each goes to its source card and lights it), the trust line, an amber note
  for each part the pages do not cover ("One thing the knowledgebase does not cover."), and a footer: helpful, not
  helpful, **Copy Answer** and **Save as Page**. Each uncovered part also gets a **Knowledge Gap** card.
- **Answers and passages are text.** They are drawn as characters with the page's own marks (a citation chip, a
  matched word), never as HTML or Markdown.
- **Sources** shows the passages of the newest answer, or of the answer a citation was pressed in: a number, the
  page's title, the headings above the passage, the passage with the question's words softly marked, and
  "<path> · Verified 8 Nov by <name>" (or "Review Due, Last Verified 8 Nov", or "Never Verified"). Pressing a card
  shows Pages at that page and passage. **Found but Not Used** follows, each card amber with a "Stale" pill and the
  reason.
- **The field** takes 1,000 characters and counts from 900. Enter sends; Shift and Enter make a new line. While an
  answer streams the field waits and the button is **Stop**, which ends the request and keeps what had arrived.
  After ten turns the field gives way to a line saying to start a new question.
- **Save as Page** makes a subpage of a page the person chooses, titled from the question, holding the answer
  without its markers and a Sources list linking each cited page.
- **Draft a Page From What We Know** makes a top-level page titled from the question whose first line is "Draft,
  Not Verified", then the question as a heading, then a draft from one more Ask call. If that call fails the page
  holds the mark and the heading alone. The draft's Ask call counts against the limits like any question.
- **The conversation lasts as long as the browser tab**: leaving Ask to read a cited page and coming back finds it,
  still streaming if it was. A reload starts a new one. Recent questions hold the question and when it was asked,
  never an answer, 50 at most.
- **When Ask is off:** no key (an Editor gets **Open AI Settings**; anyone else is told to ask an Editor), not
  signed in (a share link's visitor included: **Sign In**), or a knowledgebase kept Offline. Each says why, and
  each offers **Search the Pages**.
- **A failure** is said in the answer's place in words with its next step: the key not accepted or the model not
  allowed (Open AI Settings for an Editor), no credit, the account's rate limit, Claude busy, a lost connection (Ask
  Again), a refusal, 20 questions in the hour, 200 in the day. Never a status, a code or the upstream's words.
- Helpful and not helpful are kept on the answer for the conversation and counted in telemetry, with no words.

| Action                                 | Editor | Participant | Viewer |
| -------------------------------------- | ------ | ----------- | ------ |
| Copy an answer, mark it helpful or not | yes    | yes         | yes    |
| Save an answer as a page               | yes    | yes         | no     |

## AI Settings

- A dialog of the knowledgebase, opened by **AI Settings** in the Ask view's and AI Knowledge's header. It is not a
  category of the Settings panel: Settings holds a person's own preferences on a device and an account, and has a
  copy on liveworkspace.app where no knowledgebase is open; the key and the model belong to one knowledgebase and
  are the same for everyone in it.
- It shows the key's state ("No Key Yet", "Key Ending 4f2a"; "Key Added" to someone the ending is not told), a
  password field to add or **Replace** it, **Remove** (asked first), the **Model** and two sentences: the key is
  encrypted and never shown again, and Ask runs on the team's own key: the team pays its provider (named:
  Anthropic or OpenAI) for what it uses. It opens with the **Provider** ([Providers](#providers)).
- The typed key is held only in the field. It is read once when sent and the field is cleared in the same turn,
  whatever the answer. It is never kept in the page's state, a browser store, a log, telemetry or an error message.
- An Editor has the controls; a Participant and a Viewer see the state and the model with none.

## The three views

- A knowledgebase has three views: **Pages** (the editor), **Ask** and **AI Knowledge**
  ([AI Knowledge](ai-knowledge.md)). They are three tabs at the left of the footer, **Pages | Ask | AI Knowledge**
  ([The page surface](page-surface.md) "The footer"), on a phone too.
- The view is in the address (`?view=ask`, `?view=ai`; none is Pages), not the hash, which is the open page's. A
  reload keeps it, each change is a history entry, so Back returns to the view before, and each tab is a link.
- Ask and AI Knowledge cover the canvas and the page tree, down to the footer; their header is the top row every view
  shares, with Share and the account button at its right end. The editor under them takes no key, press or focus.
- Not offered in an embed, in zen mode, in a workbench, behind the welcome flow, to a Community visitor or through a
  link confined to one page.
