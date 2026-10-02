# Explorer filters

Status: specified. The grammar, matching, suggestion engine and view models ship in `@livediagram/explorer-lens`
(`packages/explorer-lens`); the chips, the field and the routes follow with the Explorer page.

## What

Every Explorer list can be narrowed by one **lens**: a single filter state written as one string of words and
**tokens**. People pick **chips**; experts type tokens like `opens-in:draw template:retrospective made-by:ai edited:7d`
into the top-bar search. Both edit the same string:

- Choosing a chip value **writes its token** into the string.
- Typing a token **lights its chip**.

One string means the lens fits a URL as it is, and a saved view later is that string with a name.

## Scope and lens

Two different things narrow a list, and they never mix:

- The **scope** is where you are: a folder, a team, My documents. It is the **breadcrumb**, never a chip and never a
  token. A scoped view lists what lives in its scope.
- The **lens** narrows whatever the current view lists.

An **aggregate view** lists documents from every place at once: **Recent** (and Home), the **search** results, and
**Shared with me**. Only aggregate views have no scope to narrow by, so only they show the **Space** chip and apply the
`space:` token. Every other view is a **scoped view**.

## Dimensions

Each dimension is a closed list of values. The interface says what a value means; it never calls an editor mode, a tab
kind or a template family a "type", and it keeps "board type" for what it means elsewhere: a board that leaves the
general diagram tab's environment.

| Dimension | Key        | Chip label  | Values and their labels                                                                                 |
| --------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| Text      | (none)     | (the field) | Free words                                                                                              |
| Opens in  | `opens-in` | Opens in    | `diagram` Diagram, `draw` Draw: the editor mode the document was created to open in                     |
| Kind      | `kind`     | Kind        | `event-storming` Event Storming: the first tab's kind when the document was created                     |
| Template  | `template` | Template    | `retrospective` Retrospective, `kanban` Kanban: the template family the document was made from          |
| Made by   | `made-by`  | Made by AI  | `ai` Made by AI: the document's `source` is set (the AI assistant or an AI tool through the MCP server) |
| Edited    | `edited`   | Edited      | `today` Today, `7d` Last 7 days, `30d` Last 30 days, `12m` Last 12 months, `this-year` This year        |
| People    | `people`   | People      | `me` Me, `others` Others: the owner of a document; the actor of a Timeline event                        |
| Space     | `space`    | Space       | `mine` My documents, `shared` Shared with me, `team:<id>` the team's name. Aggregate views only         |

- **Opens in**, **Kind** and **Template** read the creation intent recorded on the document
  (Default folders: `opensIn`, `tabKind`, `templateFamily` on the document
  summary). Opens in offers one value per editor mode (`EDITOR_MODES`); Kind offers the specific tab kinds, every
  creatable kind but the general diagram tab, so today only Event Storming; Template offers the template families
  (`TEMPLATE_FAMILIES`). A document whose recorded value is unknown (made before the intent was recorded) matches no
  value of that dimension; it shows whenever that dimension is not set. A general diagram tab matches no Kind value, and
  a document made from no family matches no Template value.
- **Made by AI replaces the Generated folder.** AI-made documents are no longer a bucket of their own: they live in
  Unsorted or in a folder like any other document, and `made-by:ai` finds them anywhere.
- **Edited** reads the document's last save, in local time. Today starts at midnight; Last 7 days and Last 30 days count
  back that many days from now; Last 12 months counts back 12 calendar months from now; This year starts at midnight on
  1 January. A save in the future (a skewed clock) counts as edited.
- **People** on a document is its owner: `me` when the reader owns it, `others` otherwise. Every row of Shared with me
  is `others`.
- **Space** on a document is `mine` for one in My documents or in this browser ([Offline Mode](../006-document/offline-mode.md),
  the documents the sidebar marks "Local only"), `team:<id>` for one in a team, `shared` for a row of Shared with me. A
  token names a team by id; every label shows the team's **name**, never the id.
- A row that cannot answer a dimension (a Shared with me row carries no provenance, mode, kind or family) matches no
  value of it.
- **More filters** (favourited, sharing, Drive status) join later behind a "More filters" disclosure.

## Matching

- A dimension may hold **several values**: they combine with **or** (`template:retrospective,kanban` lists both
  families). Dimensions combine with **and**.
- Text matches the document's **name**: every word must appear in it, ignoring case and accents.
- The empty lens matches everything.

## Token grammar

The string is words separated by whitespace.

- A word of the form `<key>:<values>` whose key is a dimension key is a **token**. `<values>` is one value or a
  **comma list** of them (`edited:today,7d`). Keys and values are read without regard to case and written lower case;
  a team id keeps its case.
- A dimension may also be **repeated** (`template:retrospective template:kanban`): its tokens' values join, exactly as
  one comma list does. A value listed twice counts once.
- Every other word is **text**.
- A word shaped like a token that is not one stays **text**, whole, and is **reported by a named reason**, never
  dropped. A comma list is reported by its first bad value:

| Reason              | When                                                                    | Message                                                      |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `unknown_dimension` | The key is no dimension (`colour:red`)                                  | “colour:red” isn’t a filter, so it’s searched as text.       |
| `missing_value`     | Nothing after the colon, or an empty list entry (`kind:`, `edited:7d,`) | “kind:” needs a value, so it’s searched as text.             |
| `unknown_value`     | A value is not in the list (`template:mindmap`)                         | “mindmap” isn’t a Template option, so it’s searched as text. |
| `unknown_team`      | `space:team:<id>` names no team of the reader                           | That team isn’t one of yours, so it’s searched as text.      |

- A valid token that cannot apply is kept in the string, not applied, and reported:

| Reason           | When                                              | Message                                                           |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `space_not_here` | A `space:` token on a scoped view                 | The breadcrumb sets the space here, so Space filters don’t apply. |
| `too_long`       | The string passes 512 characters; the rest is cut | The search is cut to 512 characters.                              |

- A word **being typed** (the caret is in it or at its end, in the field) that starts with a dimension key and a colon
  is **pending**: neither applied nor text, and not reported until the caret leaves it.

The **canonical** string writes **one token per dimension, its values as a comma list**: the tokens in dimension order
(Opens in, Kind, Template, Made by, Edited, People, Space), each list in its dimension's value order (teams after My
documents and Shared with me, by id), then the text words, single spaces between. Parsing accepts both spellings;
writing produces only this one. Writing a chip edits the string in place: the dimension's tokens merge into one,
written where the first stood, or added after the last token; clearing a chip removes every token of its dimension.

## The field

The top-bar search is the lens field on every Explorer view.

- Each token renders as a **pill** inside the field: "Template: Retrospective, Kanban", "Space: Acme". The free text
  follows the pills. A pill that does not apply (a Space pill on a scoped view) is muted and says why.
- A typed token becomes a pill once it is complete: accepted from the suggestions, or followed by a space.

### Suggestions

Typing in the field offers **suggestions** in a list under it:

- A word that is the start of a dimension key (`op`, `made`, `edited`) offers those **dimensions**, each with its chip
  label. Accepting one writes `<key>:` and offers its values.
- A word `<key>:<start>` offers that dimension's **values** whose value or label starts with `<start>`, each with its
  label: `edited:7d` reads "Last 7 days · Edited"; a team reads by its name. In a comma list only the entry after the
  last comma is matched, and values already in the list are not offered again.
- A value that would match nothing on its own, with every other dimension and word of the field kept, is still offered
  and **marked** "No matches"; it is never hidden.
- Space and its values are offered on aggregate views only. An empty word offers nothing.
- Accepting a value writes it into the word (after the list's earlier entries), then a space; the rest of the field is
  left as it is.

Keyboard:

| Key       | Does                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------- |
| Down / Up | Moves through the suggestions; no suggestion is active until one is pressed                     |
| Enter     | Accepts the active suggestion; with none active, nothing beyond what typing already applied     |
| Tab       | Accepts the active suggestion; with none active, moves focus on as usual                        |
| Escape    | Closes the suggestions; the field keeps its text                                                |
| Backspace | At the start of the text, right after a pill: first selects the pill, a second press removes it |

### Accessibility

- The field follows the WAI-ARIA **combobox** pattern: the input has `role="combobox"`, `aria-autocomplete="list"`,
  `aria-expanded`, `aria-controls` naming the suggestion `listbox`, and `aria-activedescendant` naming the active
  option. Its label is "Filter documents".
- Each option's name is its label and dimension, plus "no matches" when marked: "Last 7 days, Edited, no matches".
- Each pill has an accessible name ("Filter Template: Retrospective, Kanban", plus "not applied: <reason>" when muted)
  and a **remove** button named "Remove filter Template: Retrospective, Kanban", in the tab order.
- After the lens changes, a polite **live region** announces the count once typing settles: "12 of 40 documents",
  "40 documents", or "No documents match".
- Chips sit in a `group` named "Filters". A chip is **multi-select**: a button with `aria-haspopup="listbox"` and
  `aria-expanded`, named "Template: Retrospective, Kanban" when set and "Template, any" when not, opening a listbox with
  `aria-multiselectable="true"`. Its options are `option`s with `aria-selected`; choosing one toggles it, and the
  first option, "Any", clears every value. **Made by AI**, a dimension of one value, is a toggle button with
  `aria-pressed`.
- A set chip shows its values as text and each chosen option a check, never by colour alone. Text and focus rings meet WCAG 2.2 AA
  contrast; every pill, remove button and chip is at least 24 by 24 CSS pixels. Nothing animates under reduced motion.

## URL and carry-over

- The lens lives in the view's URL as `?q=<string>`, whitespace collapsed, removed when empty. Every change replaces
  the current history entry (no entry per keystroke).
- Moving between aggregate views **carries** the lens. Entering a scoped view starts with an empty lens; each view's
  URL keeps its own.
- The lens is **not** stored: a new session starts unfiltered. Saved views come later.

## States

| State          | Shows                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Empty          | The view's own empty copy, unchanged: there is nothing here at all                                     |
| Filtered empty | "No documents match these filters", the reported reasons under it, and **Clear filters** (empties `q`) |
| Failed         | "Couldn’t load documents" and **Try again**; the lens stays as it was                                  |

## Telemetry

Each time a dimension gains a value it did not hold, from a chip, an accepted suggestion or a typed token, the Explorer emits
`Explorer / Selected / <Dimension>` once, with `<Dimension>` from the closed set `Text`, `OpensIn`, `Kind`, `Template`,
`MadeBy`, `Edited`, `People`, `Space` ([Telemetry](../017-telemetry/telemetry.md)). Text counts when it goes from empty to
non-empty. Never a value, a word or an id.
