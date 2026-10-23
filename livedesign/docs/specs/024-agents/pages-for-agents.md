# Pages for agents

How an agent (the MCP tools and the CLI's verbs, [Agents](README.md)) reads and makes the pages of a tab:
logo and wireframe pages ([Pages](../007-editor/pages-mode.md), [Logo pages](../007-editor/logo-pages.md),
[Wireframe pages](../007-editor/wireframe-pages.md)). People with the design open see an agent's pages arrive at
once, as anyone's.

The bar: an agent asked to "make a poster" or "design a logo" makes it on the right kind of page on the first try, and
is never told a change worked when it shows on no page.

## Domain language

| Term            | Means                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **page**        | One `Page` of a tab, as [Pages](../007-editor/pages-mode.md) defines it                              |
| **page place**  | A page's 1-based position in the tab's row (`2` is the second page): what agents and people count by |
| **page change** | One entry of a `change_pages` call: `add`, `set`, `layout`, `move`, `duplicate` or `delete`          |

## The front doors

- **MCP**: one tool, `change_pages` ([MCP server](../015-api/mcp-server.md#49d-the-pages-tools)), and the `pages`
  view of `read_design`.
- **CLI**: `page ls` (the `pages` view) and `page set` (`change_pages`) ([CLI](../015-api/cli.md)).
- Both go through one api route, `POST /api/designs/:id/tabs/:tabId/pages`, over one pure engine shared with
  the editor, so an agent's page edit is exactly the edit the page panel makes.
- `create_design` and `add_tab` with a Pages template (`logo-design`, a wireframe flow, `blank-illustration`, ...)
  still make a tab on its pages; `change_pages` then changes it.

## Which tab

- `change_pages` takes an optional `tabId`. Absent, it acts on the design's first tab.
- A locked tab is refused (`tab_locked`).

## Naming a page

- A page is named by its **id** (`page-3f2a91c0`), its **place** (`2`, or `"2"`), or its **name** (case and spacing
  aside). An id wins over a place, a place over a name.
- An unknown page is refused (`page_unknown`) with the pages there are ("Pages: 1 Cover (infographic), 2 (infographic),
  3 Logo (logo)").
- Places are read against the pages as the changes before it left them, so `[delete 2, set 2]` sets the page that
  was third.

## `change_pages`

Up to **50** page changes, applied in order, each to the tab as the ones before it left it, written as **one**
edit. A refused change stops the batch and nothing is written; the answer names the change and why, and what the
changes before it would have done.

| Change                    | Fields                                                                                                   | Does                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add`                     | `kind` (infographic, logo, wireframe), `size?`, `orientation?`, `name?`, `background?`, `layout?`, `at?` | A new page of the kind, sized as the editor's **+** sizes it unless told, at place `at` (default the end)                                                                     |
| `set`                     | `page`, `name?`, `size?`, `orientation?`, `background?`, `locked?`                                       | The page panel's edits                                                                                                                                                        |
| `layout`                  | `page`, `layout`                                                                                         | Puts a layout onto the page in place of everything on it, as the panel's Layouts do                                                                                           |
| `move`                    | `page`, `to`                                                                                             | Moves the page to place `to`, its content with it                                                                                                                             |
| `duplicate`               | `page`                                                                                                   | A copy after it, content and all                                                                                                                                              |
| `delete`                  | `page`                                                                                                   | Removes the page and everything on it; never the last page. A later delete in the same change naming, by id, a page an earlier one took is done already, never a missing page |
| `apply_background_to_all` | `page`                                                                                                   | Every other page of the page's kind takes its background, as the Background tab's **Apply to All** does                                                                       |

- **The first page's choice**: while the tab's only page is unchosen and empty, an `add` of a kind makes that page
  the kind (`withPageKindChosen`) instead of adding a second page, so a fresh Pages tab does not keep an empty
  first page. Likewise a blank of the kind asked for (the tab's only page already of that kind, unnamed and holding
  nothing, as the Blank Infographic makes it) becomes the page added, so a design made from it does not open on an
  empty page.
- **A delete of the page an add took**: once an `add` has taken the first page that way, the empty page is gone, so a
  later `delete` in the same call naming that page (by place or id) means the empty page and is done already: it
  deletes nothing and says so (`Page 1 was the empty first page, which change 1 made the page it added; nothing
deleted.`). An agent replacing a starter page writes `[add, delete 1]`, and without this the delete would remove the
  page it just added, or be refused as the tab's only page.
- **Sizes**: a page takes only the sizes its kind offers (`pageSizesFor`); any other is refused (`size_not_offered`)
  naming the ones it takes. Fit to Content is never chosen (`size_not_offered`). A logo page has no
  orientation; turning one is refused (`no_orientation`).
- **Backgrounds**: `{ color }` (a hex) is a solid fill, `{ gradient: [from, to], angle? }` a two-stop gradient
  (angle in degrees, default 160, the panel's), `pattern` one of `dots`, `grid`, `lines` or `none`, `{ paper: true }` back to the
  plain paper. A logo page takes no pattern (`pattern_not_offered`). A new fill re-inks what is on the page as the panel does
  (`pageInkFor`, [Re-inking](../007-editor/pages-mode.md#re-inking)), from the colours as they are (the
  editor's session memory is the editor's).
- **Apply to all**: `apply_background_to_all` gives every other page of the page's kind (every infographic page, say) its
  background, fill and pattern, re-inking each ([Copying a background](../007-editor/pages-mode.md#copying-a-background)).
  A locked page keeps its own and the line says how many did ("Gave 34 other infographic pages the background of page 1;
  2 locked kept their own"). With no other page of the kind it is refused (`no_other_pages`). It is how an agent
  gives a whole set of pages one background: `set` the first page's, then this, in the same call.
- **Layouts**: a layout id the page's kind offers (`layoutCatalogueFor`); any other is refused (`layout_unknown`)
  naming the kind's layouts. Laid out in the page's content box, in the tab's theme.
- **Locks**: a locked page refuses every change but `set { locked: false }` (`page_locked`).
- **Limit**: a tab holds at most 100 pages (`MAX_PAGES`); an `add` or `duplicate` past it is refused
  (`page_limit`).
- **The answer**: one line per change ("Added page 3 (infographic, A4) from layout Report Cover", "Deleted page 2 and 4
  elements on it"), then the tab's pages as they now are: place, id, name, kind, size and orientation, the page's
  rectangle on the canvas (`x, y, width, height`) and how many elements are on it. Elements are put onto a page with
  `update_design`, at coordinates inside its rectangle.

## Reading: the `pages` view

`read_design` with `view: "pages"` (the CLI's `page ls`, and `read --view pages`) answers, for a Pages tab:

- each page in row order: place, id, name, kind, size and orientation, the rectangle, background, locked, and the
  refs of the elements on it (the outline's refs, [Design views](design-views.md));
- the layouts each kind on the tab offers, by id and label.

The view keeps to the read budget. The outline's header names a Pages tab's page count and points at the view.

## The route

`POST /api/designs/:id/tabs/:tabId/pages` with `{ pages: PageChange[], base?: rev }`.

- Open to anyone who may edit the tab (a person's session or an API token); a read-only token is refused as every
  write is.
- Reads the tab at its revision, applies the engine, and writes the tab at that revision: elements through the
  changeset write (so their ops are recorded, merged into later saves, relayed and revertible), the pages with
  them in the same batch. A revision that moved meanwhile is read again and applied
  once more; a second move answers `409 tab_busy`.
- Relays to the design's room what an editor's own edit sends: the changeset's element ops, a `tab-meta`
  `{ pages }` patch. The room relays without
  reading them, as it does an editor's.
- **Known gap** (the tab rename's, [Agent changesets](agent-changesets.md#whole-tab-saves-and-tab-renames)): a
  whole-tab save an editor already had in flight when the write landed carries the pages it had. The
  relay reaches that editor first in every other case, and its next save carries the agent's.
- Refusals answer `400` (or `409`, `413`) with `{ error: <code>, message }`, the codes above, the same text on the
  CLI and the MCP.

## Observability

Every decision logs with the `[pages-agent]` fingerprint: `applied` (design, tab, changes, rev), `refused`
(code, change index), `stale-retry`, `relay-missed`.

## Telemetry

- An agent's page change sends the server-side `Agent · Applied` with its front door (`Mcp`,
  `Cli`, `Api`), as a changeset does; a refusal sends nothing.
- Reading the `pages` view sends `Agent · Viewed · Pages`, as every view does.
- Each tool call and CLI verb counts as every one does: `Mcp · Used · ChangePages` and
  `Cli · Used · PageLs|PageSet`, charted on the telemetry dashboard (`apps/telemetry`).

## Non-goals

- A picture of the pages in the tool answer (the PNG the diagram tools return draws elements, not pages).
- Recording page writes in the changeset history for revert (only their elements are).
