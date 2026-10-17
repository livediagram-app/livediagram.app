# Tags

Status: shipped

## What

A **tag** is a coloured label a person makes and puts on their documents, so related documents can be gathered
together whichever folder or team they live in. A document can carry any number of tags; a tag can sit on any number of
documents. The **Tags** page, under **More** in the Explorer sidebar, shows the documents grouped by tag.

Folders answer "where does this live"; a document is in exactly one. Tags answer "what is this about": a client, a
project, a quarter, a status, cutting across folders and teams. That is why a tag is not a folder and never moves
anything.

## A tag

| Field  | What it holds                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| Name   | 1 to 32 characters, trimmed, runs of whitespace kept as one space. Unique per person, ignoring case             |
| Colour | A standard colour by name (`blue`, `green`, ...), drawn in its version for light or dark, or a custom `#rrggbb` |

- **Tags are personal.** Each person has their own set, and putting a tag on a document marks it for that person only,
  like a [Favourite](favourites.md). Tagging a team document does not tag it for the rest of the team; a teammate never
  sees your tags. A tag grants no access and reveals nothing.
- **At most 100 tags** a person (`TAG_LIMIT`). Plenty for labelling, and it bounds every list a tag appears in.
- Tags list **alphabetically** by name everywhere (the picker, the Tags page, the sidebar, a row's chips), so a tag is
  always where the reader expects it.
- A **new tag's colour** is the hued standard colour (in the order Blue, Green, Orange, Violet, Teal, Pink, Red,
  Yellow) the person's tags use least, the earliest on a tie, so tags start out telling apart; it can be changed at
  once.

## Which documents take tags

The reader's own documents (My Documents, This browser) and their teams' documents. A document **shared with you**
takes none: it lives in the sharer's library, its menu offers Open and Dismiss only, the same rule as Favourites.

## Putting tags on a document

**Tags** in the document menu, on every surface that menu appears (an Explorer page row or card, a Details row, Home's
cards, the editor's Explorer panel rows), between Favourite and History. Its icon is a tag. Choosing it closes the menu
and opens the **tag picker** at the same place.

### The tag picker

A small panel (an anchored popover named "Tags for <document>") that stays open while the reader works through it:

1. A **field**, focused on opening: "Find or create a tag". Typing narrows the list to the tags whose name contains the
   text, ignoring case.
2. The **list**: each tag a checkbox row, its colour dot, its name, then its colour button. Ticking puts the tag on the
   document, unticking takes it off, at once, with no Save.
3. While the text matches no tag exactly, the list ends with **Create "<text>"**, its dot in the colour the new tag will
   take. Choosing it makes the tag and puts it on the document, and clears the field.
4. A footer link, **Manage Tags**, opens the Tags page.

- **Keyboard.** Down from the field moves into the list, Up and Down move between rows, Space or Enter toggles a row.
  Enter in the field toggles the tag whose name matches exactly, else creates one. Escape closes the picker and hands
  focus back to the control it opened from.
- **The colour button** (a swatch) opens the [Colour picker](../004-interface-design/colour-picker.md) in its
  swatch-button skin: the standard colours in the strong tone, then Custom Colours (the custom colours the reader's
  other tags use), ending in Add a custom colour. No Theme Palette: a tag belongs to no tab.
- **No tags yet**, with an empty field: "No tags yet. Type a name to make your first."
- A name over 32 characters shows "Keep a tag's name to 32 characters." in place of Create.
- **At the limit**, Create is replaced by a line: "You have 100 tags, the most there can be. Delete one on the Tags page
  to make room."
- A name already used (in another case) is never offered to Create; the matching tag shows instead.

## Where tags show

- **On a row or card.** A tagged document shows its tags as **chips** after its name in the list and Details views and
  on a line of its own under a card's name (so the card's meta row keeps its time): a pill holding a dot of the tag's colour and its name, on a faint wash of that colour, so any
  colour reads on either appearance. At most **two chips**, then **+N** for the rest, whose tooltip names them all.
  Pressing a chip opens that tag's page; it never opens the document. On a phone a list row shows the dots below
  instead, so the name keeps its room; cards keep their chips. When a row is squeezed its name truncates first and
  the chips then truncate their names too, each down to its dot and a few letters, so they never run over the badges
  beside them (Local only, Made by AI, the folder).
- **In the editor's Explorer panel** a row shows up to three **dots** after its name (the panel row is narrow), with a
  tooltip naming the tags. They are not buttons.

## The Tags page

At `/explorer/tags`, the **Tags** row in the sidebar's More group.

- **The header** offers **New Tag** and the List, Card and Details toggle.
- **The body** is one **section per tag**, alphabetical: a heading holding the tag's chip, its document count ("3
  documents"), and its menu (`⋯`: Rename, Change Colour, Delete), then the tag's documents, newest first, in the view the
  toggle picked, with the same rows, menus and folder chips as Recent. A document with two tags shows under both: that
  is the grouping.
- A tag on no documents shows its heading over one quiet line: "Nothing tagged yet. Choose Tags in a document's menu to
  add some."
- **No tags at all**: the Explorer's illustrated empty state, "Group related documents with tags", "Make a tag here, or
  choose Tags in any document's menu. Your tags are yours alone: nobody else sees them.", and **New Tag**.

### One tag's page

At `/explorer/tags?id=<id>`, reached from a tag's sidebar row, a chip, or a section heading's name.

- Titled with the tag's name; the breadcrumb is **Tags › <name>**. The header holds the tag's menu (Rename, Change
  Colour, Delete) beside the view toggle.
- The body lists the tag's documents as the Tags page's sections do. With none: "Nothing tagged <name> yet".
- An id that is not one of the reader's tags (deleted since, or a link from someone else) opens the Tags page.

### Making, renaming, recolouring and deleting

- **New Tag** and **Rename** open the **tag dialog**: a Name field and the colour picker (inline skin), with **Create
  Tag** or **Save**. The field says why it can't be saved ("Give the tag a name", "You already have a tag called
  Design").
- **Change Colour** opens the colour picker in a popover from the menu's anchor; a pick applies at once.
- **Delete** asks first, in a confirm popover: "Delete the tag Design? It comes off its 4 documents. The documents
  stay." Deleting cannot be undone. A deleted tag's page falls back to the Tags page.

## The sidebar

**Tags** sits in More, after This browser and before Library, always shown (so it can be found before the first tag).
It opens the Tags page and expands to one child row per tag: a dot of the tag's colour, its name, and its document count
as the badge. A tag's row opens its page. Tags starts collapsed unless a Tags page is the current view. Its expanded
state is the sidebar's (`more:tags`).

## The editor's Explorer panel

The rail's More group gains **Tags** between This browser and Library. Its pane shows each tag as a section heading
(the chip and its count) over its documents as panel rows, with the panel's compact empty state ("No tags yet") when
there are none, and **Open Page** to the Tags page.

The panel's tags load the first time something in the editor needs them (the Tags section, a panel row, a document
menu), so opening the editor costs no extra request.

## Storage

Two tables (migration `0094_tags.sql`):

- `tags (id, owner_id, name, colour, created_at, updated_at)`, `id` a client-minted UUID; a unique index on
  `(owner_id, name COLLATE NOCASE)` enforces the one name per person.
- `document_tags (tag_id, document_id, created_at)`, primary key `(tag_id, document_id)`, both foreign keys
  `ON DELETE CASCADE`: deleting a tag takes it off every document, and a purged document drops its tags. An index on
  `document_id` keeps the document cascade a seek.

A document in the Trash keeps its tags for a restore, and is left out of every tag list while it is there.

Like Favourites, tags are their own tables rather than keys in the 4 KB preferences blob: a person's tags and links
outgrow it quickly, and overflowing it would fail every preference write.

### An offline document's tags live in the browser

An offline document ([Offline Mode](../006-document/offline-mode.md)) has no `documents` row, so its tag ids are kept
on its offline record (`tagIds`) and never sent to the server, exactly as its star is. The list merges the two, dropping
an offline record's ids for tags that no longer exist. Take Offline carries the document's tags onto the record; Sync
Document puts them back on the cloud copy.

### Tags follow the owner

Both owner-wide operations ([Owner-keyed data](../015-api/api.md#owner-keyed-data)) cover `tags.owner_id`:

- **Account deletion** deletes the person's tags; their links cascade.
- **Signing up** carries a guest's tags into the account. A guest tag whose name the account already uses merges into
  the account's tag (its documents gain the account's tag, then the guest's tag goes); the rest move over. The 100 limit
  is checked when a tag is made, so a merge may leave an account above it, able to delete but not to add.

## API

Owner-scoped, hybrid identity like the rest of the api, guests included.

| Route                                        | Does                                                | Answers                                                                                    |
| -------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /api/tags`                              | The reader's tags and their links to live documents | `{ tags: Tag[], links: { tagId, documentId }[] }`                                          |
| `POST /api/tags`                             | Make a tag: `{ id, name, colour }`                  | 201 `{ tag }`; 400 `invalid_tag`; 409 `tag_name_taken`; 409 `tag_limit`                    |
| `PUT /api/tags/:id`                          | Rename and / or recolour: `{ name?, colour? }`      | `{ tag }`; 400 `invalid_tag`; 404 not the reader's; 409 `tag_name_taken`                   |
| `DELETE /api/tags/:id`                       | Delete the tag (its links cascade)                  | 204; 404 not the reader's                                                                  |
| `PUT /api/tags/:id/documents/:documentId`    | Put the tag on the document, idempotently           | 204; 404 when the tag is not the reader's or the document does not exist (the foreign key) |
| `DELETE /api/tags/:id/documents/:documentId` | Take it off; silent when it was not on              | 204; 404 not the reader's tag                                                              |

`Tag` is `{ id, name, colour, createdAt }`. Like a star, putting a tag on a document checks no access to the document:
the link is the tagger's private row, and the Tags page shows only documents the reader can already open.

## Optimistic changes

Every change shows at once and the request goes behind it. A failed request puts the change back and says so in a
toast ("Couldn't save that tag change. Try again."), unlike a star, because a tag that silently vanished would lose
the reader's grouping work. The client checks the name and the limit before it asks, so the server's refusals are only
a race with another tab.

## Who may do what

Tags are the reader's own, on the reader's own lists. The document menu's **Tags** shows on every document in the
reader's library or their teams' (wherever the menu offers its full verbs), whatever share role the reader holds on a
document open in the editor. A document shared with the reader (Editor, Participant or Viewer alike) takes no tags: its
menu is Open and Dismiss. Nothing in a shared session, an embed or a share link shows or changes anyone's tags.

## Telemetry

`Explorer` events, types from a closed list ([Telemetry](../017-telemetry/telemetry.md)): `Created·Tag` (a tag made),
`Added·Tag` / `Removed·Tag` (put on or taken off a document), `Renamed·Tag`, `Changed·TagColour`, `Deleted·Tag`.
Never a tag's name.

## Out of scope

- A `tag:` filter token in the Explorer lens. The Tags page is the grouping view; a token is the natural next step.
- Tagging several documents at once.
- Tags shared across a team.
