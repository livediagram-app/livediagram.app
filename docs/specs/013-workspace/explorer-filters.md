# Explorer filters

Status: specified. The grammar, matching, suggestion engine and view models ship in `@livediagram/explorer-lens`
(`packages/explorer-lens`); the chips, the field and the routes follow with the Explorer page.

## What

Every Explorer list can be narrowed by one **lens**: a single filter state written as one string of words and
**tokens**. People pick **chips**; experts type tokens like `opens-in:draw board:retrospective made-by:ai edited:7d`
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

Each dimension is a closed list of values. The interface says what a value means; it never calls an editor mode a
"type".

| Dimension | Key        | Chip label  | Values and their labels                                                                                 |
| --------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| Text      | (none)     | (the field) | Free words                                                                                              |
| Opens in  | `opens-in` | Opens in    | `diagram` Diagram, `draw` Draw: the editor mode the document was created to open in                     |
| Board     | `board`    | Board       | `event-storming` Event storming, `retrospective` Retrospective, `kanban` Kanban                         |
| Made by   | `made-by`  | Made by AI  | `ai` Made by AI: the document's `source` is set (the AI assistant or an AI tool through the MCP server) |
| Edited    | `edited`   | Edited      | `today` Today, `7d` Last 7 days, `30d` Last 30 days, `year` Last 12 months                              |
| People    | `people`   | People      | `me` Me, `others` Others: the owner of a document; the actor of a Timeline event                        |
| Space     | `space`    | Space       | `mine` My documents, `shared` Shared with me, `team:<id>` the team's name. Aggregate views only         |

- **Opens in** values are the editor modes, one value per mode, read from the one editor-mode list (Editor modes,
  `EDITOR_MODES`). **Board** values are the board types of Default folders (`BOARD_TYPES`). Both are the creation
  intent recorded on the document (`opensIn`, `boardType` on the document summary). A document whose recorded value is unknown (made before the
  intent was recorded) matches no value of that dimension; it shows whenever that dimension is not set.
- **Made by AI replaces the Generated folder.** AI-made documents are no longer a bucket of their own: they live in
  Unsorted or in a folder like any other document, and `made-by:ai` finds them anywhere.
- **Edited** reads the document's last save. Today starts at local midnight; the others count back from now (7 and 30
  days, 12 calendar months). A save in the future (a skewed clock) counts as edited.
- **People** on a document is its owner: `me` when the reader owns it, `others` otherwise. Every row of Shared with me
  is `others`.
- **Space** on a document is `mine` for one in My documents or this browser, `team:<id>` for one in a team, `shared`
  for a row of Shared with me. A token names a team by id; every label shows the team's **name**, never the id.
- A row that cannot answer a dimension (a Shared with me row carries no provenance, mode or board) matches no value of
  it.
- **More filters** (favourited, sharing, Drive status, this browser) join later behind a "More filters" disclosure.

## Matching

- Dimensions combine with **and**. A dimension holds **one value**.
- Text matches the document's **name**: every word must appear in it, ignoring case and accents.
- The empty lens matches everything.

## Token grammar

The string is words separated by whitespace.

- A word of the form `<key>:<value>` whose key is a dimension key is a **token**. Keys and values are read without
  regard to case and written lower case; a team id keeps its case.
- Every other word is **text**.
- A word shaped like a token that is not one stays **text** and is **reported by a named reason**, never dropped:

| Reason              | When                                           | Message                                                   |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| `unknown_dimension` | The key is no dimension (`colour:red`)         | “colour:red” isn’t a filter, so it’s searched as text.    |
| `missing_value`     | Nothing after the colon (`board:`)             | “board:” needs a value, so it’s searched as text.         |
| `unknown_value`     | The value is not in the list (`board:mindmap`) | “mindmap” isn’t a Board option, so it’s searched as text. |
| `unknown_team`      | `space:team:<id>` names no team of the reader  | That team isn’t one of yours, so it’s searched as text.   |

- A valid token that cannot apply is kept in the string, not applied, and reported:

| Reason           | When                                              | Message                                                           |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `superseded`     | A later token of the same dimension follows it    | Only the last Board filter applies.                               |
| `space_not_here` | A `space:` token on a scoped view                 | The breadcrumb sets the space here, so Space filters don’t apply. |
| `too_long`       | The string passes 512 characters; the rest is cut | The search is cut to 512 characters.                              |

- A word **being typed** (the caret is in it or at its end, in the field) that starts with a dimension key and a colon
  is **pending**: neither applied nor text, and not reported until the caret leaves it.

The **canonical** string is the tokens in dimension order (Opens in, Board, Made by, Edited, People, Space), then the
text words, single spaces between. Writing a chip edits the string in place: the dimension's token is replaced where it
stands, or added after the last token; clearing a chip removes every token of its dimension.

## The field

The top-bar search is the lens field on every Explorer view.

- Each token renders as a **pill** inside the field: "Board: Kanban", "Space: Acme". The free text follows the pills.
  A pill that does not apply (superseded, not here) is muted and says why.
- A typed token becomes a pill once it is complete: accepted from the suggestions, or followed by a space.

### Suggestions

Typing in the field offers **suggestions** in a list under it:

- A word that is the start of a dimension key (`op`, `made`, `edited`) offers those **dimensions**, each with its chip
  label. Accepting one writes `<key>:` and offers its values.
- A word `<key>:<start>` offers that dimension's **values** whose value or label starts with `<start>`, each with its
  label: `edited:7d` reads "Last 7 days · Edited"; a team reads by its name.
- A value that would match nothing, with every other word of the field kept, is still offered and **marked**
  "No matches"; it is never hidden.
- Space and its values are offered on aggregate views only. An empty word offers nothing.
- Accepting a value writes the token and a space, and removes any other token of the same dimension.

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
- Each pill has an accessible name ("Filter Board: Kanban", plus "not applied: <reason>" when muted) and a **remove**
  button named "Remove filter Board: Kanban", in the tab order.
- After the lens changes, a polite **live region** announces the count once typing settles: "12 of 40 documents",
  "40 documents", or "No documents match".
- Chips sit in a `group` named "Filters". A chip is a button with `aria-haspopup="listbox"` and `aria-expanded`,
  named "Board: Kanban" when set and "Board, any" when not; its options are `option`s with `aria-selected`, and the
  first option, "Any", clears it. **Made by AI** is a toggle button with `aria-pressed`.
- A set chip shows its value as text and a check, never by colour alone. Text and focus rings meet WCAG 2.2 AA
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

Each time a dimension gains a value, from a chip, an accepted suggestion or a typed token, the Explorer emits
`Explorer / Selected / <Dimension>` once, with `<Dimension>` from the closed set `Text`, `OpensIn`, `Board`, `MadeBy`,
`Edited`, `People`, `Space` ([Telemetry](../017-telemetry/telemetry.md)). Text counts when it goes from empty to
non-empty. Never a value, a word or an id.
