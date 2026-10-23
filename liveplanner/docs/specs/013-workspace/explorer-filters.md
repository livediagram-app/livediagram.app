# Explorer filters

Status: shipped on the shared Explorer, [`@liveworkspace/explorer`](../../../../packages/explorer/README.md). The
grammar, matching, suggestion engine and view models live in its `src/lens/` (pure, no DOM or React); the field, the
chips and the states are `src/explorer/SearchField.tsx` and `src/explorer/Lens.tsx`. The index narrows the lists
themselves: the filters are `GET /items` and `GET /shared` query parameters
([one-explorer-contracts.md](../../../../liveworkspace/docs/one-explorer-contracts.md) "The lens's filters").

## What

Every Explorer list can be narrowed by one **lens**: a single filter state written as one string of words and
**tokens**. People pick **chips**; experts type tokens like `template:retrospective made-by:ai edited:7d` into the
top-bar search. Both edit the same string:

- Choosing a chip value **writes its token** into the string.
- Typing a token **lights its chip**.

One string means the lens fits a URL as it is, and a saved view later is that string with a name.

## Scope and lens

Two different things narrow a list, and they never mix:

- The **scope** is where you are: a folder, a team, My Work. It is the **breadcrumb**, never a chip and never a
  token. A scoped view lists what lives in its scope.
- The **lens** narrows whatever the current view lists.

An **aggregate view** lists items from every place at once: **Recent**, **Favourites**, **Shared With Me**,
**Unsorted** and **Search results**. Only aggregate views have no scope to narrow by, so only they show the **Space**
chip and apply the `space:` token. My Work, a folder and a team are **scoped views**.

Which apps' items a list holds is the **Plans / All** switch in the page header, not a dimension of the lens.

## Views

| View                                                         | Route                                                                                                    | Lens                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------- |
| My Work, and each of its folders                             | `/explorer/all`, `/explorer/folder?id=<id>`                                                              | Scoped                            |
| A team, at its root or in one of its folders                 | `/explorer/team?id=<id>`                                                                                 | Scoped                            |
| Recent, Favourites, Shared With Me, Unsorted, Search results | `/explorer/recent`, `/explorer/favourites`, `/explorer/shared`, `/explorer/unsorted`, `/explorer/search` | Aggregate                         |
| Home, Inbox, Timeline, Trash                                 | Their own                                                                                                | None: typing opens Search results |

- **Search results** (`/explorer/search`) lists every item the reader can open: their own, every team's they have
  joined, and Shared With Me, newest first (the index's `view=search`). It has no sidebar row.
- A view that lists no items has no lens of its own. Typing into the field there takes the reader to Search results
  with what they typed, the field keeping focus; the view they left keeps no `q`.
- **A scoped lens reaches the whole scope.** While a lens is set on a scoped view, the list holds every matching item
  in the scope, its subfolders at any depth included (`deep=1` on a folder; `view=all` on My Work and a team's root),
  as one flat list, newest first. Folder rows step aside while the lens is set and return when it is cleared. A row
  from a subfolder names its folder.
- The old Generated view's address, `/explorer/generated`, opens Search results filtered by `made-by:ai`.

## The chip row

Every list view shows one row of chips under its page header and breadcrumb:

- One chip per dimension, in dimension order (Template, Made by AI, Edited, People), then **Space** on aggregate views
  only. Template shows only when the host names template families (`lensTemplates`).
- **Clear** ends the row while the lens is set and empties `q`. It keeps its place when hidden, so nothing moves.
- A chip opens a listbox of its values under it. Choosing a value toggles it and leaves the listbox open; Escape, Tab,
  a click outside or the chip again closes it, focus returning to the chip.
- Under the row, every reported issue reads as one line, its word named (the messages of the
  [Token grammar](#token-grammar)).
- On a phone the row scrolls sideways in one line.

## Dimensions

| Dimension | Key        | Chip label  | Values and their labels                                                                          | Index filter |
| --------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------ | ------------ |
| Text      | (none)     | (the field) | Free words                                                                                       | `q`          |
| Template  | `template` | Template    | `retrospective` Retrospective, `kanban` Kanban: the template family the plan was made from       | `intent`     |
| Made by   | `made-by`  | Made by AI  | `ai` Made by AI: the item's `source` is `ai`, an AI tool through the MCP server (not the CLI)    | `source=ai`  |
| Edited    | `edited`   | Edited      | `today` Today, `7d` Last 7 days, `30d` Last 30 days, `12m` Last 12 months, `this-year` This year | `since`      |
| People    | `people`   | People      | `me` Me, `others` Others: the item's owner                                                       | `owner`      |
| Space     | `space`    | Space       | `mine` My Work, `shared` Shared With Me, `team:<id>` the team's name. Aggregate views only       | `space`      |

- **Template** reads the last word of the creation intent the index records (`plan:board:kanban` is Kanban). An item
  whose intent is unknown (made before it was recorded) matches no Template value; it shows whenever Template is not
  set.
- **Made by AI is a filter, not a place.** AI-made items live at the root of their space or in a folder like any
  other, and `made-by:ai` finds them anywhere. Every row, card and details row of an AI-made item carries a **Made by
  AI** pill (a sparkle and the words), so what the filter reads is visible.
- **Edited** reads the item's last save, in local time. Today starts at midnight; Last 7 days and Last 30 days count
  back that many days from now; Last 12 months counts back 12 calendar months; This year starts at midnight on
  1 January. Several values keep the widest. The cutoff sent to the index is rounded to the minute, so a list is not
  read again every millisecond.
- **People** is the owner: `me` when the reader owns the item, `others` otherwise. Both values together admit
  everyone and send nothing.
- **Space** is `mine` for an item in My Work, `team:<id>` for one in a team, `shared` for one reached through a link.
  A token names a team by id; every label shows the team's **name**.
- **Opens in** is retired: the Plans / All switch says which items show. An old link's `opens-in:` token is read as no
  filter and reported (`retired`). **Kind** was not carried over: a plan's tabs are not in the index.

## Matching

- The index matches: the lists page, so the reader's side cannot narrow them. A dimension may hold **several
  values**: they combine with **or**. Dimensions combine with **and**.
- Text matches the item's **title or the name of its folder**: every word must appear in one of them. It is SQLite
  `LIKE`, so capitals are ignored for ASCII letters and accents are not folded ("cafe" does not find "Café").
- The empty lens matches everything.
- The Explorer still runs the lens's non-text dimensions over a row the reader just changed (renamed, moved, shared),
  so the row stays honest until the list is read again (`compileLens`, `{ text: false }`).

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

| Reason              | When                                                                        | Message                                                      |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `unknown_dimension` | The key is no dimension (`colour:red`)                                      | “colour:red” isn’t a filter, so it’s searched as text.       |
| `missing_value`     | Nothing after the colon, or an empty list entry (`template:`, `edited:7d,`) | “template:” needs a value, so it’s searched as text.         |
| `unknown_value`     | A value is not in the list (`template:mindmap`)                             | “mindmap” isn’t a Template option, so it’s searched as text. |
| `unknown_team`      | `space:team:<id>` names no team of the reader                               | That team isn’t one of yours, so it’s searched as text.      |

- A valid token that cannot apply is kept in the string, not applied, and reported:

| Reason           | When                                              | Message                                                                          |
| ---------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `space_not_here` | A `space:` token on a scoped view                 | The breadcrumb sets the space here, so Space filters don’t apply.                |
| `retired`        | An `opens-in:` token from an old link             | “opens-in:plan” no longer filters: the Plans / All switch says which plans show. |
| `too_long`       | The string passes 512 characters; the rest is cut | The search is cut to 512 characters.                                             |

- A word **being typed** (the caret is in it or at its end, in the field) that starts with a dimension key and a colon
  is **pending**: neither applied nor text, and not reported until the caret leaves it.

The **canonical** string writes **one token per dimension, its values as a comma list**: the tokens in dimension order
(Template, Made by, Edited, People, Space), each list in its dimension's value order (teams after My Work and Shared
With Me, by id), then the text words, single spaces between. Parsing accepts both spellings;
writing produces only this one. Clearing a chip removes every token of its dimension. The index takes at most 16 words
and 8 values per filter.

## The field

The top-bar search is the lens field on every Explorer view; on Home it is the hero's. Its placeholder reads "Search
or filter plans" (the host's word for its items).

- Each token renders as a **pill** inside the field: "Template: Retrospective, Kanban", "Space: Acme". The free text
  follows the pills. A pill that does not apply (a Space pill on a scoped view) is muted and says why.
- A typed token becomes a pill once it is complete: accepted from the suggestions, or followed by a space.

### Suggestions

- A word that is the start of a dimension key (`made`, `ed`) offers those **dimensions**. Accepting one writes
  `<key>:` and offers its values.
- A word `<key>:<start>` offers that dimension's **values** whose value or label starts with `<start>`. In a comma
  list only the entry after the last comma is matched, and values already in the list are not offered again.
- When the list on screen is loaded whole, a value that would match nothing on its own is still offered and **marked**
  "No matches"; it is never hidden. A list with more pages to come marks nothing, since it cannot know.
- Space and its values are offered on aggregate views only. An empty word offers nothing.

| Key       | Does                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------- |
| Down / Up | Moves through the suggestions; no suggestion is active until one is pressed                     |
| Enter     | Accepts the active suggestion                                                                   |
| Tab       | Accepts the active suggestion; with none active, moves focus on as usual                        |
| Escape    | Closes the suggestions; a second press clears the words                                         |
| Backspace | At the start of the text, right after a pill: first selects the pill, a second press removes it |

### Accessibility

- The field is a WAI-ARIA **combobox** labelled "Filter plans", controlling the suggestion `listbox`.
- Each pill has an accessible name ("Filter Template: Retrospective, Kanban", plus "not applied: <reason>" when muted)
  and a remove button.
- After the lens changes, a polite **live region** announces the count once the list has loaded and 400 ms have
  passed: "12 plans", "50 or more plans" while more pages remain (the index pages and gives no total), or "No plans
  match". Arriving at a view says nothing.
- Chips sit in a `group` named "Filters". A multi-select chip is a button with `aria-haspopup="listbox"`, named
  "Template: Retrospective, Kanban" when set and "Template, any" when not, opening a listbox with
  `aria-multiselectable="true"` whose first option, "Any", clears it. **Made by AI** is a toggle button with
  `aria-pressed`.
- A set chip shows its values as text and each chosen option a check, never by colour alone.

## URL and carry-over

- The lens lives in the view's URL as `?q=<string>`, whitespace collapsed, removed when empty. Every change replaces
  the current history entry (`onNavigate(view, href, { replace: true })`). While typing, the address follows the field
  at most every 250 ms (a trailing write) and at once when the field loses focus: a write per keystroke ran a held key
  past Safari's limit of 100 history writes in 10 seconds. The first search from a view with no lens is a new entry,
  so Back returns to it.
- Moving between aggregate views **carries** the lens. Entering a scoped view, or a view with no lens, starts with an
  empty lens; each view's URL keeps its own. Back and Forward restore the lens of the entry they land on.
- The lens is **not** stored: a new session starts unfiltered.

## States

| State          | Shows                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Empty          | The view's own empty copy, unchanged: there is nothing here at all                                 |
| Filtered empty | "No plans match these filters", the reported reasons under it, and **Clear Filters** (empties `q`) |
| Failed         | "Couldn’t load this list." and **Try again**; the lens stays as it was                             |

## Telemetry

Each time a dimension gains a value it did not hold, from a chip, an accepted suggestion or a typed token, the
Explorer calls the host's `onLensSelected(<Facet>)` once, and liveplanner emits `Explorer / Selected / <Facet>`, with
`<Facet>` from the closed set `Text`, `Template`, `MadeBy`, `Edited`, `People`, `Space` (`LENS_TELEMETRY_TYPES`).
Text counts when it goes from empty to non-empty. Never a value, a word or an id. A lens arriving with a link, or
restored by Back, counts for nothing. `OpensIn` and `Kind` are retired types.

## Help

The help centre's [Search and Filter Plans](../../../apps/help/app/explorer/filters/page.mdx) article describes the
field, the chips and the typed filters; Search results opens it from its Help button.
