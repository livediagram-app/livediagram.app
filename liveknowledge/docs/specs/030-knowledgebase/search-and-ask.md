# Search and Ask

Status: **spec**, not built ([Build plan](../005-project-roadmap/build-plan.md) steps 8 and 9).

## Search

- The top bar's field, and Cmd or Ctrl K, search the current wiki: page titles first, then passages, each result
  showing the page, its breadcrumb, its verified state and the matching lines with the words marked.
- The index lives in the wiki's Durable Object: an FTS5 table over each page's title and its writing split into
  **passages** (a heading and the blocks under it, at most 1,200 characters). The room rewrites a page's rows when
  its writing is saved, in the same transaction as the link table.
- Search needs no model and no key. It works for every role, signed in or through a share link, and Offline wikis
  search in the browser over the same passages.
- **Bounds:** a query is at most 200 characters, returns at most 20 passages, and is rate-limited per caller. Indexing
  a save is linear in the page's length; a 100,000 character page must index within 50 ms of CPU (a test holds it).

## Ask

Ask answers a question in plain words from the wiki's own pages, and says where each part came from.

- **Bring your own key.** liveknowledge is free and pays for no model. Ask is offered once an Editor adds the wiki's
  **Claude API key** in **AI Settings**. Without a key the Ask tab explains this with one button to AI Settings, and
  search still works.
- **The key** is sent once over TLS to the api, encrypted with AES-GCM under the Worker's `AI_KEY_SECRET`, and kept in
  the wiki's Durable Object. It is never sent back to any client: AI Settings shows only "Key Ending 4f2a", **Replace**
  and **Remove**. Logs and telemetry never hold it. A wiki kept Offline has no Ask.
- **Model:** Claude, `claude-fable-5-2` by default; AI Settings offers the current Claude models, since the team
  pays for what it uses.
- **Answering:** the api takes the question, finds the best passages with the search index (up to 12, verified pages
  first), and asks the model to answer only from them, citing each claim. The answer streams to the page.
- **What an answer shows:** the answer with numbered citations; a **Sources** rail with each cited passage, its page
  and who verified it when; a trust line ("Answered From 3 Verified Pages", or how many were unverified or due);
  **Found but Not Used** for a passage set aside because it is stale and disagrees with a newer verified one.
- **It does not guess.** The model is told to say so when the passages do not answer the question or part of it. That
  part is recorded as an unanswered question ([AI Knowledge](ai-knowledge.md)) and shown as a **Knowledge Gap** card
  with **Draft a Page From What We Know** and **Ask <owner> to Write It**.
- **Scope:** an answer reads only pages the asker can open. A follow-up keeps the conversation (up to 10 turns).
  Recent questions are kept per person, per wiki, in the browser.
- **Bounds:** 20 questions a person an hour and 200 a wiki a day (`ASK_*` limits, checked in the room); a question is at
  most 1,000 characters; the passages sent are capped at 24,000 characters. A failed or refused model call says
  which (bad key, no credit, rate limit) in words, never a raw error.

## Share roles

| Action                                  | Editor | Participant | Viewer |
| --------------------------------------- | ------ | ----------- | ------ |
| Search                                  | yes    | yes         | yes    |
| Ask                                     | yes    | yes         | yes    |
| Add, replace or remove the key, model   | yes    | no          | no     |
| Draft a page from a gap                 | yes    | no          | no     |

Ask through an anonymous share link is off: it would spend the team's key for strangers.

## AI Settings

- A dialog of the knowledgebase, opened by **AI Settings** in the Ask view's and AI Knowledge's header. It is not a
  category of the Settings panel: Settings holds a person's own preferences on a device and an account, and has a
  copy on liveworkspace.app where no knowledgebase is open; the key and the model belong to one knowledgebase and
  are the same for everyone in it.
- It shows the key's state ("No Key Yet", "Key Ending 4f2a"; "Key Added" to someone the ending is not told), a
  password field to add or **Replace** it, **Remove** (asked first), the **Model** and two sentences: the key is
  encrypted and never shown again, and the team pays Anthropic for what Ask uses.
- The typed key is held only in the field. It is read once when sent and the field is cleared in the same turn,
  whatever the answer. It is never kept in the page's state, a browser store, a log, telemetry or an error message.
- An Editor has the controls; a Participant and a Viewer see the state and the model with none.

## The three views

- A knowledgebase has three views: **Pages** (the editor), **Ask** and **AI Knowledge**
  ([AI Knowledge](ai-knowledge.md)). A segmented switch, **Pages | Ask | AI Knowledge**, sits in the top row's card
  beside Share on a desktop; on a phone it has a row of its own above the top row.
- The view is in the address (`?view=ask`, `?view=ai`; none is Pages), not the hash, which is the open page's. A
  reload keeps it, each change is a history entry, so Back returns to the view before, and each segment is a link.
- Ask and AI Knowledge cover the canvas, the page tree and the bottom bar; the top row's card stays over their top
  right corner. The editor under them takes no key, press or focus.
- Not offered in an embed, in zen mode, in a workbench, behind the welcome flow, to a Community visitor or through a
  link confined to one page.
