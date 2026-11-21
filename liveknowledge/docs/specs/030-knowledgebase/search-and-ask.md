# Search and Ask

Status: **Search is built, not yet verified in a browser** ([Build plan](../005-project-roadmap/build-plan.md) step 8;
[blueprint](blueprints/knowledge-ui.md)): the universal search panel with This Knowledgebase as its first group; its
field stands at the head of the page tree. Ask (step 9) is its own change.

## Search

Owner, 2026-11-20: the sidebar's search is the **universal search**, with this knowledgebase's results first.

- **No second list of pages** (sweep 2026-11-21): the panel has no Pages or canvas-elements group and no Add to Canvas group; This Knowledgebase lists the pages and their passages.
- **Where it opens** (owner 2026-11-21): over the view showing. Ask and AI Knowledge stay behind it; only picking a page
  shows Pages, at that page.
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

- **Built-in AI, or your own key** (owner, 2026-11-21: "the ability to also use the built in AI we provide, OR use a
  custom key"). Ask runs on **built-in AI** by default: Cloudflare Workers AI through the api's `AI` binding, the
  model Describe to Set Up uses ([The model](describe-to-set-up.md#the-model)), billed to liveknowledge, with no key
  and no setup. A team that wants its own provider adds its **own key**, Claude's or OpenAI's
  ([Providers](#providers)), in **AI Settings**; once saved, everything that uses a model runs on it instead. A
  stored key that cannot be opened is refused ("Replace it in AI Settings"), never quietly swapped for built-in AI.
  With no key, the Ask view says quietly under the field **Uses built-in AI**.
- **Choosing which AI answers** (owner, 2026-11-21: "on Ask, I want to be able to choose whether to ask my configured
  AI, or the built in AI"). Once a key applies ([Which key answers](#which-key-answers)), the quiet line under Ask's field becomes a small choice of two, **Answer With**:
  **Built-In AI** and the team's key named by its model ("Claude Fable 5.2 (Team Key)"). The team's key is chosen
  until the person picks otherwise; the choice is kept per person, per knowledgebase, in this browser, beside the
  chats. Each question carries it (`ai: 'built-in' | 'key'`); a follow-up uses the choice in force when it is asked,
  so switching mid-chat applies to the next question. The server honours `built-in` even when a key is set, under
  built-in AI's caps ([Built-in AI](#built-in-ai)), and even when the stored key cannot be opened (the person asked
  for built-in AI, so nothing is swapped quietly); `key` with no key set answers on built-in AI, which is what the
  person sees. With a key set, each answer says on its trust line which AI answered ("Built-In AI", or the
  model). Draft a Page From What We Know, the conflict check and Describe to Set Up keep the key first.
- **Built-in AI's bounds**, since liveknowledge pays for it ([Built-in AI](#built-in-ai)).
- **The key** is sent once over TLS to the api, encrypted with AES-GCM under the Worker's `AI_KEY_SECRET`, and kept in
  the knowledgebase's Durable Object. It is never sent back to any client: AI Settings shows only "Key Ending 4f2a", **Replace**
  and **Remove**. Logs and telemetry never hold it. A knowledgebase kept Offline has no Ask.
- **Model:** on built-in AI, `@cf/google/gemma-4-26b-a4b-it` (its thinking off), not a choice. On the team's key,
  Claude `claude-fable-5-2` by default (or OpenAI's most capable); AI Settings offers the provider's current models,
  since the team pays for what it uses.
- **Answering:** the api takes the question, finds the best passages with the search index (up to 12, verified pages
  first), and asks the model to answer only from them, citing each claim. The answer streams to the page.
- **What an answer shows:** the answer with numbered citations, numbered **1 to n in the order they are first
  cited** (owner, 2026-11-21: "shouldn't the source be number 1, given there is only one source?"), whatever number
  the passage was sent to the model under: the stream's pieces, the finished answer and its Sources all use the same
  numbers, and so does each follow-up's own answer; a **Sources** rail with each cited passage, its page
  and who verified it when; a trust line ("Answered From 3 Verified Pages", or how many were unverified or due);
  **Found but Not Used** for a passage set aside because it is stale and disagrees with a newer verified one. A
  set-aside carries its reason; a bare mark with none (a small model marks any passage it skipped) sets nothing
  aside, so a page is never called Stale without a why.
- **It does not guess.** The model is told to say so when the passages do not answer the question or part of it. That
  part is recorded as an unanswered question ([AI Knowledge](ai-knowledge.md)) and shown as a **Knowledge Gap** card
  with **Draft a Page From What We Know** and, once it has an email of its own (the review emails are built; this
  one is not), **Ask <owner> to Write It**.
- **Scope:** an answer reads only pages the asker can open. A follow-up keeps the conversation (up to 10 turns).
  Chats are kept per person, per knowledgebase, in the browser ([The Ask view](#the-ask-view)).
- **Bounds:** 20 questions a person an hour and 200 a knowledgebase a day (`ASK_*` limits, checked in the room),
  whichever AI answers, and on built-in AI the [Built-in AI](#built-in-ai) caps too; a question is at most 1,000
  characters; the passages sent are capped at 24,000 characters. A failed or refused model call says
  which (bad key, no credit, rate limit) in words, never a raw error.

## Which key answers

Owner, 2026-11-21: a person's and a team's own AI key, kept once in liveworkspace and used in every app
([liveworkspace/docs/specs/003-accounts/ai-keys.md](../../../../liveworkspace/docs/specs/003-accounts/ai-keys.md)).
The knowledgebase's own key stays, and comes first.

- **The order**, for Ask, Draft a Page From What We Know and Describe to Set Up: the knowledgebase's own key (AI
  Settings), else its team's key (the knowledgebase's team, when the asker is a joined member), else the asker's own
  key, else built-in AI. Asking for built-in AI (`ai: 'built-in'`) skips the keys, as before.
- **The conflict check** runs in the background, with no asker whose request could prove who they are, so it uses
  the knowledgebase's own key or built-in AI only, never a team's or a person's.
- **Only a signed-in person's own request** reaches a shared key: the api forwards the person's access token to
  accounts, which checks it and their team itself (`aiKeyFor`). An API token, an agent, a workbench session, a guest
  or a link visitor gets the knowledgebase's key or built-in AI.
- **A shared key that will not open** is refused in words ("Your team's AI key could not be read. An admin can
  replace it in Settings, under AI." or "Your AI key could not be read. Replace it in Settings, under AI."), never
  swapped quietly for the next in line.
- **The plain key** is held in the one request's memory for the one call, never stored in the room.
- **Which is in use** is said in AI Settings ("Uses This Knowledgebase's Key", "Uses Your Team's Key", "Uses Your Key",
  "Uses Built-In AI"), with **Your AI Keys** linking to the shared Settings category (`?settings=ai`), and on Ask's
  **Answer With**, whose second choice names the key's model and its source ("Claude Fable 5.2 (Team Key)", "(Your
  Key)", "(Knowledgebase Key)"). `GET ai` answers it as `uses` (`knowledgebase`, `team`, `personal`, `built-in`) with
  `usesModel` and its name `usesModelLabel`, read for the asker; the AI Knowledge overview does not ask accounts.

## Built-in AI

Owner, 2026-11-21: Ask, the conflict check and Draft a Page run on built-in AI when the knowledgebase has no key, as
Describe to Set Up already does. **Built**, against the e2e stand-in; the live binding's stream is read in both shapes
Workers AI sends (`{ response }` pieces and chat-completion `choices[0].delta.content` pieces).

- **One path.** Everything that asks a model hands the same provider-neutral request to one call, whose provider is
  `built-in`, `anthropic` or `openai`. Built-in AI is never a provider a key can be saved for.
- **Ask streams on built-in AI** too: the binding is asked with `stream: true` and its pieces are read as they come,
  through the same answer reader as the providers' (markers renumbered, the form's tags held back).
- **Caps** (liveknowledge pays, so they are lower than a key's; each counted before the call, so a failed call still
  spent one):
  - **Questions:** 30 a person a UTC day across every knowledgebase (`ASK_BUILT_IN_PER_PERSON_PER_DAY`, counted per
    account as Describe's 10 are, so a new knowledgebase never buys more), and 100 a knowledgebase a day
    (`ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY`), beside Ask's own 20 an hour and 200 a day. **Draft a Page** is one
    question against the same caps.
  - **Conflict checks:** 20 a knowledgebase a day on built-in AI (`CONFLICT_BUILT_IN_CHECKS_PER_DAY`; 50 on a key),
    still once a page per 10 minutes, 5 pairs a check, one call each.
  - **Describe to Set Up:** unchanged, 10 a person a day.
  - **Each call** writes at most 2,000 tokens (`BUILT_IN_MAX_TOKENS`) and is given up after 60 seconds.
  - A fault reaching a cap's count refuses the call rather than lifting the cap.
- **Worst case a day** (every cap spent): a person, 30 questions and 20 Describe asks (10 suggestions, each up to two
  asks), 50 calls; a knowledgebase, 100 questions, 20 checks and 40 Describe asks, 160 calls.
- **Failures read in words:** "Built-In AI Is Not Set Up Here" (a deployment with no `AI` binding: an Editor is
  offered AI Settings to add the team's key), "You Have Used Today's 30 Built-In Questions" (try tomorrow, or add
  the team's key), "This Knowledgebase Has Used Today's Built-In Questions", and "The Built-In AI Could Not Answer"
  (try again in a moment). Never the binding's own words.
- **Under the e2e stack** the stand-in's `POST /workers-ai/run` answers built-in calls, streamed when asked, so no
  test reaches Cloudflare.

## Providers

Owner, 2026-11-20: a team may bring an **OpenAI** key instead of a Claude one. **Built** (the package, the api
and AI Settings; [blueprint](blueprints/knowledge-package.md) "Providers", "The OpenAI API"); no real model was
called for either provider, so the request and stream shapes are unverified against the live APIs.

- AI Settings asks first which AI: **Built-In AI** (the default, "Included", no key) or **Your Own Key**; for a key,
  the **provider**, **Anthropic (Claude)** or **OpenAI**, then the key and the model. A
  knowledgebase holds one provider and one key at a time; choosing the other provider replaces the key after a
  confirmation.
- Everything that uses a model runs on whichever is set, with the same behaviour, limits and words: Ask, the
  conflict check, drafting a page from a gap and [Describe to Set Up](describe-to-set-up.md), each on built-in AI
  when no key is set ([Built-in AI](#built-in-ai)). The interface says "your team's AI key" wherever it does not
  matter which, and names the provider where it does (a refused key: "OpenAI Did Not Accept the Key").
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
- **The api:** `GET ai` answers `{ provider, hasKey, keyHint, model, models, providers, builtIn }` (`builtIn`:
  whether this deployment has built-in AI); `PUT ai/key` takes
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

Ask through an anonymous share link is off: it would spend the team's key, or liveknowledge's built-in AI, for
strangers.

## The Ask view

- **Three columns** on a window at least 1,024px wide: the person's chats (**New Question**, then their chats under
  Today, This Week and Earlier, then **Completed Questions**), the conversation with the question field at its foot,
  and **Sources**. Narrower, they stack in that order with the chats folded under a **Recent** button, the
  Completed Questions group inside it the same way.
- **A chat** is one conversation: its first question names it, and pressing it opens it in the conversation with
  its answers as they were, to read or to continue. Chats are kept in this browser, per person and knowledgebase
  (`localStorage`, beside where recent questions were kept): each chat's turns with their answers and sources,
  50 chats at most, the oldest going first, and never more than about 1.5 MB in all.
- **Accept Answer** (owner, 2026-11-21: "always let me choose Accept Answer to move the chat into a collapsed
  Completed Questions category"): the latest answer of a chat, once it has ended with an answer, always offers
  **Accept Answer** in its footer, calm and first. Accepting moves the chat out of the dated groups into
  **Completed Questions**, a group closed by default that shows its count ("Completed Questions 3"), and the
  conversation returns to a fresh question field. A completed chat opens to read, with **Reopen** where the field
  was: Reopen moves it back among the dated groups and gives it the field again.
- **Delete** (owner, 2026-11-21): every chat, in the dated groups and in Completed Questions, has **Delete**, an icon
  button with a tooltip at the row's end (shown on hover or focus, always on touch). It asks first ("Delete This
  Question?", naming it, "This cannot be undone."), as deleting a comment does. Deleting the open chat returns the
  conversation to a fresh question field. It removes the chat from this browser; what AI Knowledge already counted
  (questions asked, pages answered from) stays, since those hold no asker.
- **The conversation.** A question is a dark bubble at the right. An answer is a white bordered card that streams
  in, then shows numbered citation chips (each goes to its source card and lights it), the trust line, an amber note
  for each part the pages do not cover ("One thing the knowledgebase does not cover."), and a footer: helpful, not
  helpful, **Copy Answer** and **Save as Page**. Each uncovered part also gets a **Knowledge Gap** card.
- **Answers and passages are text.** They are drawn as characters with the page's own marks (a citation chip, a
  matched word), never as HTML or Markdown.
- **No outside links in an answer** (security review, 2026-11-21): a page's writing could carry a prompt injection
  that has the model write a phishing link, so in an answer only this knowledgebase's own pages are pressable (its
  citation chips). A link the model writes to anywhere else, `https` included, is drawn as plain text: its words,
  then the address in brackets, never a link.
- **Sources** shows the passages of the newest answer, or of the answer a citation was pressed in. A source card
  (owner, 2026-11-21: "show a verified tick, or the absence of one... the bottom line is just one long line that gets
  cut off"), top to bottom:
  - its number (the answer's own, 1 first) and the page's title;
  - the page's path as a breadcrumb (Foundations / Colour) on its own line, the parents shortened from the start so
    the page's own name always shows; the headings above the passage follow it. A top-level page has no path line
    (its name is the title already), and a heading that only repeats the title is left out;
  - the passage with the question's words softly marked;
  - its **trust**, in the badges and colours of the page's meta row and Page Health: **Verified** (a green tick),
    then "21 Nov by Roger Blake" on the line, wrapping to a second line rather than cutting a name; **Review Due**
    (amber, "Last verified 8 Nov"); **Never Verified** (quiet slate, no tick, saying so).
    Pressing a card shows Pages at that page and passage. **Found but Not Used** follows, each card amber with a
    "Older Passage" pill and the reason under its passage, its trust in the same badges as a source, and no
    number, so it never shares one with a cited source. One with no reason (kept in the browser from before a
    set-aside needed one) is not shown.
- **The field** takes 1,000 characters and counts from 900. Enter sends; Shift and Enter make a new line. While an
  answer streams the field waits and the button is **Stop**, which ends the request and keeps what had arrived.
  After ten turns the field gives way to a line saying to start a new question.
- **Save as Page** makes a subpage of a page the person chooses, titled from the question, holding the answer
  without its markers and a Sources list linking each cited page.
- **Draft a Page From What We Know** makes a top-level page titled from the question whose first line is "Draft,
  Not Verified", then the question as a heading, then a draft from one more Ask call. If that call fails the page
  holds the mark and the heading alone. The draft's Ask call counts against the limits like any question. A title
  made from a question (here and Save as Page) drops a closing full stop, since a Knowledge Gap is a sentence and a
  title has none; a question mark stays.
- **The conversation lasts as long as the browser tab**: leaving Ask to read a cited page and coming back finds it,
  still streaming if it was. A reload starts a fresh field, and the chat is in the list with every answer that
  had ended.
- **When Ask is off:** not signed in (a share link's visitor included: **Sign In**), a knowledgebase kept Offline,
  or, on a deployment with no built-in AI, no key ("Built-In AI Is Not Set Up Here": an Editor gets **Open AI
  Settings**; anyone else is told to ask an Editor). A knowledgebase with no key is not off: built-in AI answers.
  Each says why, and each offers **Search the Pages**.
- **The Ask gate** (owner 2026-11-21: "couldn't that have been a modal / drawer on mobile rather than another screen
  entirely"): pressing the Ask tab when Ask is off for not being signed in (or, with no built-in AI, for no key) stays on the knowledgebase
  and opens those same words in a dialog over it, a sheet on a phone. Its actions close it first (Open AI Settings
  opens over Pages). The key is read on the first press only, never on load. Ask's address followed from a link
  still shows them in the view.
- **Offline, in the footer** (owner 2026-11-21): a knowledgebase kept Offline keeps the Ask and AI Knowledge tabs,
  quieter and going nowhere. Hovering one (a long press on a phone, focus from the keyboard) shows "Ask Needs
  Syncing" (or "AI Knowledge Needs Syncing"), why ("This knowledgebase is kept in this browser. Ask and AI Knowledge require your content to be synced to our servers.") and **Sync
  Knowledgebase**, the Share dialog's sync in place. Once it lands the tabs open as usual.
- **A failure** is said in the answer's place in words with its next step: the key not accepted or the model not
  allowed (Open AI Settings for an Editor), no credit, the account's rate limit, Claude busy, a lost connection (Ask
  Again), a refusal, 20 questions in the hour, 200 in the day, and built-in AI's own ([Built-in AI](#built-in-ai)). Never a status, a code or the upstream's words.
- Helpful and not helpful are kept on the answer for the conversation and counted in telemetry, with no words. A chosen one colours its hand, filled (green for helpful, rose for not), not the button behind it.

| Action                                  | Editor | Participant | Viewer |
| --------------------------------------- | ------ | ----------- | ------ |
| Copy an answer, mark it helpful or not  | yes    | yes         | yes    |
| Accept an answer, reopen, delete a chat | yes    | yes         | yes    |
| Save an answer as a page                | yes    | yes         | no     |

## AI Settings

- A dialog of the knowledgebase, opened by **AI Settings** in the Ask view's and AI Knowledge's header. It is not a
  category of the Settings panel: Settings holds a person's own preferences on a device and an account, and has a
  copy on liveworkspace.app where no knowledgebase is open; the key and the model belong to one knowledgebase and
  are the same for everyone in it.
- It opens with **Which AI**: two bordered rows, **Built-In AI** ("No key to add. Daily limits apply.", an "Included" pill)
  and **Your Own Key** ("Anthropic or OpenAI, billed to your team"). With no key saved Built-In AI is chosen;
  with one, Your Own Key. Choosing Your Own Key shows the **Provider** ([Providers](#providers)), the key and the
  **Model**; until a key is saved built-in AI stays in use. Choosing Built-In AI with a key saved asks first
  ("Use Built-In AI Instead?") and removes the key. On a deployment with no built-in AI its row says "Not set up
  on this server" and cannot be chosen.
- For a key it shows the key's state ("No Key Yet", "Key Ending 4f2a"; "Key Added" to someone the ending is not
  told), a password field to add or **Replace** it, **Remove** (asked first), the **Model** and two sentences: the
  key is encrypted and never shown again, and the team pays its provider (named: Anthropic or OpenAI) for what it
  uses. On built-in AI: one line, that questions, conflict checks and drafts run on built-in AI with daily limits.
- The typed key is held only in the field. It is read once when sent and the field is cleared in the same turn,
  whatever the answer. It is never kept in the page's state, a browser store, a log, telemetry or an error message.
- An Editor has the controls; a Participant and a Viewer see the state and the model with none.
- Under Which AI, one line says which AI answers this person now, and **Your AI Keys** opens the shared Settings
  category ([Which key answers](#which-key-answers)): with no knowledgebase key, a team's or the person's own key
  answers before built-in AI.

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
