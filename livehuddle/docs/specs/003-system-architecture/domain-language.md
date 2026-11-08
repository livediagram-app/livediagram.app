# Domain language

## Mode, kind and template

Three words describe how a document and its tabs differ. They answer different questions and are never
interchangeable. These are design decisions, taken before any feature that uses them.

| Term         | Answers                        | Values                                                      | Where it lives                       |
| ------------ | ------------------------------ | ----------------------------------------------------------- | ------------------------------------ |
| **mode**     | How is a tab worked on?        | the meeting board, the one mode (`EditorMode` `'workshop'`) | Every tab; `Tab.opensIn` reads as it |
| **kind**     | What is a tab?                 | the general diagram tab (`TabKind`)                         | `Tab.kind`                           |
| **template** | What was a document made from? | a template (`TemplateKind`), grouped into template families | Captured once, at creation           |

### Mode

- An **editor mode** is how a tab is worked on. livehuddle has one, the **meeting board** (`'workshop'` in the code,
  forked from livediagram's Workshop), so every tab is in it and there is no switch
  ([Editor modes](../007-editor/editor-modes.md), [The meeting board](../012-collaboration/workshop-mode.md)).
- A mode is never a type of document or tab.
- Whiteboarding is an activity. There is no whiteboard tab kind, mode or document type.
- Holding a meeting (a stand-up, an all-hands) is what the meeting board is for. A session is an activity, never a
  tab kind or a stored thing; "Session" and "Collaborate" never name the mode.
- The interface never says "Workshop" (Work Tracker #423): running a workshop is livediagram's Workshop mode
  ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)). Since part 3 the interface names no mode and no
  template category after workshops; `EditorMode` stays `'workshop'` in the code and in storage. No Community
  category is about workshops either: a post stored under a retired one reads as Something Else
  ([Community](../025-community/community.md#categories)).

### Kind

- A **tab kind** is what a tab is. It is reserved for boards that do not follow the homogeneous environment of the
  general diagram tab, with their own notation, rules and data.
- The general diagram tab is the default kind, and livehuddle's only one. (Plan's Board, Sheet, Dashboard and Form
  tabs went to liveplanner with Plan mode, and Event Storming boards stayed with livediagram; a stored one reads as
  a general tab.)
- A new kind is added only when the general tab cannot serve the use.
- "Board type" means a kind. It never names a template or a mode.

### Template

- A **template** is what a document was made from. It shapes the starting content of a general diagram tab and
  then has no further hold on it.
- Templates group into **template families** where a family is meaningful to people, for example the Spaces (several
  floor plans built from the same office pieces).
- A template or a template family is never a kind or a type: a virtual office is a general tab made from the Virtual
  Office template.

### Using the three together

- **Default folders** are keyed in the order kind, template family, then mode ([Default folders](../013-workspace/default-folders.md)).
- **Explorer filters** offer them as separate chips: Opens in (mode), Kind and Template ([Explorer filters](../013-workspace/explorer-filters.md)).
- Code, copy and specs use these words only in these meanings.

## Diagram elements

The words for the diagram-building elements ([The card](../009-elements/card.md), [The badge](../009-elements/badge.md),
[The step number](../009-elements/step-number.md), [The boundary](../009-elements/boundary.md),
[Timeline](../009-elements/timeline.md)).

| Term                | Means                                                                                   | Never called                              |
| ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Card**            | The diagram element (`card`) with a header band, media, title, meta line, body and tags | node card, info card                      |
| **slot**            | One part of a Card a person switches on or off                                          | section, field (in copy)                  |
| **Badge**           | The small pill element (`badge`)                                                        | tag (a tag is a chip inside a Card), pill |
| **Step number**     | The numbered disc element (`step`)                                                      | marker (that is a shape's status mark)    |
| **attachment**      | A badge or step number held on one of eight points of a host element                    | group, pin, dock                          |
| **host**            | The element an attached badge or step number sits on                                    | parent                                    |
| **Boundary**        | The titled, tinted container element (`boundary`)                                       | zone, group, frame                        |
| **concept graphic** | The Timeline: one element laying out its own rows                                       | SmartArt, diagram                         |
| **row**             | One milestone of a concept graphic (`conceptRows`)                                      | item                                      |

## Agents

The words for a program working on documents for a person ([Agents](../024-agents/README.md)).

| Term               | Means                                                                                                   | Never called                            |
| ------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **agent**          | A program acting as a person through their API token: a script or an AI tool calling the API            | bot, AI user, assistant                 |
| **changeset**      | One agent write to one tab: atomic, sequenced by the room, attributed, revertable                       | batch, commit, patch                    |
| **edit operation** | One step in a changeset (`set`, `add`, `connect`, ...), compiled into element ops                       | op (that is a room op), action, command |
| **view**           | A read-only text projection of a tab (outline, graph, layout, ...)                                      | mode, format                            |
| **ref**            | The short name a view prints for an element: its id, or its shortest unique id prefix                   | handle (that is a mention), alias       |
| **selector**       | An expression matching one or more elements (a ref, `type:sticky`, `in:f1`)                             | query, filter (that is the Explorer's)  |
| **lint finding**   | One problem the diagram lint reports (`box-overlap`), with the refs involved                            | warning, issue                          |
| **access level**   | What a share link, embed or token admits: Viewer, Participant or Editor (`view`, `participate`, `edit`) | permission, scope (the field is `role`) |
| **ownership**      | The owner's powers over a document (sharing, delete, move), apart from any level                        | admin, edit level                       |

- **Participant** is the access level; a person's name and colour (the `participants` table) are their
  **display identity**.
- An **element op** (`ElementOp`) stays the room's unit; an edit operation is the agent's, and compiles into them.
- A **verb** (`tab.view`, `element.set`) is one thing an agent asks of the API, whatever calls it.

## Colours

The words for choosing a colour ([Colour picker](../004-interface-design/colour-picker.md)).

| Term                     | Means                                                                                             | Never called                        |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **colour picker**        | The one control that chooses a colour, in any skin                                                | swatch picker, palette, colour well |
| **standard colours**     | The ten named colours every picker offers (Ink or White, Grey, Red ... Pink)                      | stock colours, presets              |
| **tone**                 | Which version of the standard colours a picker offers: `strong` (lines, text) or `soft` (fills)   | shade, variant, a drawing finish    |
| **theme colours**        | The active theme's own colours, offered on the canvas only                                        | presets                             |
| **Custom colours**       | The colours picked with + in the document, kept with its tabs                                     | custom swatches, recent colours     |
| **custom colour editor** | The square, hue, hex and eyedropper panel that **Add a custom colour** (four coloured dots) opens | colour wheel, native picker         |
| **skin**                 | Where and how a picker opens: inline, field, swatch button                                        | variant, mode                       |

## Drawing

The words for how elements are drawn, apart from their colours ([Finish](../008-canvas/finish.md)).

| Term           | Means                                                                                           | Never called                   |
| -------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| **finish**     | The drawing style of a tab and its elements: Flexible (default), Professional, Sketch or Marker | tone, look, style, render mode |
| **Follow Tab** | An element with no finish of its own, drawn in its tab's                                        | inherit, default               |

## Community

The words for the public gallery of published documents ([Community](../025-community/community.md)).

| Term               | Means                                                                                       | Never called                          |
| ------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Community**      | The public gallery of published documents; the app at `/community`                          | Gallery, Showcase or Feed as its name |
| **post**           | One document published to Community (`CommunityPost`); a document has at most one           | listing (in code), entry, submission  |
| **author**         | The signed-in owner who published a post, shown by their display identity                   | creator, poster, publisher            |
| **category**       | The one coarse subject of a post, from a closed set (`architecture`, `flows`, ...)          | type, kind (that is a tab's), section |
| **tag**            | A normalised free-form word on a post, up to five                                           | label, keyword, topic                 |
| **community link** | The view-role share link a post owns: never listed, never expires, no room, no comments     | public link, gallery link             |
| **community key**  | The random per-browser key the Community app sends for likes and reports; never an owner id | voter id, device id                   |

- **Edit Listing** names the act of changing a post's details in copy; the thing is still a post.

## Animation

- An **animation set** is the catalogue of animations one family of elements takes: Shape, Sticky, Drawing,
  Media, Table, and Text for words ([Element animations](../028-animation/element-animations.md)). Icons, charts
  and arrows keep sets of their own.
- An element's **body set** animates the element; the **Text set** animates its words. A set is never a kind or a
  mode.
- A **reveal** brings an element or its words in; a **loop** repeats around the rest frame.

## Space

What people see a livehuddle item called is a **Space** (plural **Spaces**), as the platform names it
(liveworkspace's one-explorer spec: livehuddle makes Spaces, livediagram Canvases, liveplanner Plans, livedocuments
Documents and livedesign Designs; `APP_KINDS` in `@liveworkspace/index-client`). Settled as D6 (a) in
[Open decisions](../005-project-roadmap/open-decisions.md): it is the word a team already uses for where it meets, and
it matches the Spaces templates that make one. Copy follows the app's casing: **New Space**, **Open Space**,
**Share This Space**, "Untitled Space", "your spaces". The shared Explorer takes the word from `KIND_WORDS` in
`packages/explorer/src/words.ts`, never from copy of its own. Only what people see is renamed: code, types, API
routes, URL paths (`/document/<id>`), storage keys,
telemetry events and database columns still say **document**, and specs that describe them do too. Search keywords
keep "document" and "canvas" beside "space", so an old search still finds the command or article. Spaces stored as
"Untitled canvas", "Untitled Workshop" or "Untitled document" still count as untitled.

"Canvas" stays the word for the **drawing surface** of a tab (pan the canvas, an empty canvas, the canvas
controls); a Space holds tabs, and each tab has a canvas. A sentence that would say both reads as "your work"
instead. The tab menu's item for putting a tab into another space is **Add to Another Space**, apart from the
palette's **Add to canvas**, which puts an element on the drawing surface. The **Document** shape is a shape, not an
item, and keeps its name. The Spaces templates (Virtual Office, Rooftop Bar, Garden Retreat and the rest) are
templates a Space is made from, in the Campus, Events, Games Rooms, Homes, Office, Outdoor, Recreation and Venues categories. "Space" the key (hold Space to
pan) is a key, never the item.

## This Browser

**This Browser** is the one name for a canvas saved only in this browser ([Offline Mode](../006-document/offline-mode.md)):
the place it lives (the Explorer's This Browser section, beside My Work and the teams), the pill and badge that
mark it, and where a new guest's documents start. A document is **in This Browser**; it is never "Local Only",
"Local Browser" or "offline" in copy. "Offline Mode" stays the name of the feature, and code may say `offline`.

## Names in a sentence

Copy that builds a phrase around a name (a field, a note, a template, a chart type, an element type in
an agent's error) takes its article from the name: `withArticle` / `indefiniteArticle` in `@livehuddle/document`
(re-exported by `@livehuddle/ui`). A vowel sound takes "an" ("Add an image",
"Create an Org Chart", "is not an Estimate option"), and a vowel said "you" keeps "a" ("a User Persona", "a
UML Class"). A fixed "a" before an interpolated name is how "Create a Org Chart" reached the marketing site.
