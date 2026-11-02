# Domain language

## Mode, page kind and template

Three words describe how a document and its pages differ. They answer different questions and are never
interchangeable.

| Term          | Answers                        | Values                                                        | Where it lives                                     |
| ------------- | ------------------------------ | ------------------------------------------------------------- | -------------------------------------------------- |
| **mode**      | How is a tab worked on?        | Pages (`EditorMode`)                                          | `editor-mode.ts`; a new document's creation intent |
| **page kind** | What is a page?                | a slide, an infographic, an article, a flashcard (`PageKind`) | `Page.kind`; a tab's is its first page's           |
| **template**  | What was a document made from? | a Pages template (`TemplateKind`)                             | Captured once, at creation                         |

### Mode

- livedocuments has one **editor mode**, Pages: every tab is a run of pages on a surround
  ([Pages mode](../007-editor/pages-mode.md)). The mode stays a named value (`EDITOR_MODE_CATALOGUE` in
  `packages/document/src/editor-mode.ts`, `DEFAULT_EDITOR_MODE`) so the places that name one (a new document's
  `CREATION_INTENT`, a placement default) read through one type, `isEditorMode`.
- A tab stores no mode: the editor resolves it once (`useEditorMode`).
- A mode is never a type of document or tab.

### Page kind

- What a **page** is (an infographic or design page, a slide, an article page or a flashcard) is the page's kind
  ([Pages mode](../007-editor/pages-mode.md)). Every page of a tab is of one page kind, its first page's
  (`tabPageKind`), so a deck holds only slides. A tab itself has no kind.
- A **note card** is not a page kind: it is one card of a slide's speaker notes (`Slide.noteCards`), plain text on
  the deck's slide, the smaller form of a flashcard ([Speaker note cards](../012-collaboration/speaker-note-cards.md)).
  A flashcard is a page; a note card never is.

### Template

- A **template** is what a document was made from. It shapes the starting pages of a tab and then has no further
  hold on it.
- A template is never a kind or a type: a slide deck is a tab of slides made from the Slide Deck template.
- Code, copy and specs use these words only in these meanings.

## Page elements

The words for the elements a page is built from ([The card](../009-elements/card.md), [The badge](../009-elements/badge.md),
[The step number](../009-elements/step-number.md), [Concept graphics](../009-elements/concept-graphics.md)).

| Term                | Means                                                                           | Never called                              |
| ------------------- | ------------------------------------------------------------------------------- | ----------------------------------------- |
| **Card**            | The element (`card`) with a header band, media, title, meta line, body and tags | node card, info card                      |
| **slot**            | One part of a Card a person switches on or off                                  | section, field (in copy)                  |
| **Badge**           | The small pill element (`badge`)                                                | tag (a tag is a chip inside a Card), pill |
| **Step number**     | The numbered disc element (`step`)                                              | marker (that is a shape's status mark)    |
| **attachment**      | A badge or step number held on one of eight points of a host element            | group, pin, dock                          |
| **host**            | The element an attached badge or step number sits on                            | parent                                    |
| **concept graphic** | A Layer stack, Pyramid or Cycle: one element laying out its own rows            | SmartArt, diagram                         |
| **row**             | One layer, tier or step of a concept graphic (`conceptRows`)                    | item                                      |

## Agents

The words for a program working on documents for a person ([Agents](../024-agents/README.md)).

| Term               | Means                                                                                                   | Never called                            |
| ------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **agent**          | A program acting as a person through their API token: an MCP client, a CLI caller, a script             | bot, AI user, assistant                 |
| **changeset**      | One agent write to one tab: atomic, sequenced by the room, attributed, revertable                       | batch, commit, patch                    |
| **edit operation** | One step in a changeset (`set`, `add`, `connect`, ...), compiled into element ops                       | op (that is a room op), action, command |
| **view**           | A read-only text projection of a tab (outline, layout, ...)                                             | mode, format                            |
| **ref**            | The short name a view prints for an element: its id, or its shortest unique id prefix                   | handle (that is a mention), alias       |
| **selector**       | An expression matching one or more elements (a ref, `type:sticky`, `in:f1`)                             | query, filter (that is the Explorer's)  |
| **access level**   | What a share link, embed or token admits: Viewer, Participant or Editor (`view`, `participate`, `edit`) | permission, scope (the field is `role`) |
| **ownership**      | The owner's powers over a document (sharing, delete, move), apart from any level                        | admin, edit level                       |

- **Participant** is the access level; a person's name and colour (their accounts profile, served as `/api/participants`) are their
  **display identity**.
- An **element op** (`ElementOp`) stays the room's unit; an edit operation is the agent's, and compiles into them.
- A CLI **command** and an MCP **tool** are the two front doors to one **verb** (`tab.view`, `element.set`).

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

## Workbenches

The words for the editor framed beside code ([Workbench embeds](../013-workspace/workbench-embeds.md)).

| Term                    | Means                                                                                 | Never called                           |
| ----------------------- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| **workbench**           | A developer tool that frames the editor beside an agent (an agent workbench, VS Code) | host (that is a profile's server), IDE |
| **selection reference** | The text naming what was selected, attached to a person's message to their agent      | context, selection payload             |

## Animation

- An **animation set** is the catalogue of animations one family of elements takes: Shape, Sticky, Drawing,
  Media, Table, and Text for words ([Element animations](../028-animation/element-animations.md)). Icons, charts
  and arrows keep sets of their own.
- An element's **body set** animates the element; the **Text set** animates its words. A set is never a kind or a
  mode.
- A **reveal** brings an element or its words in; a **loop** repeats around the rest frame.

## This Browser

**This Browser** is the one name for a document saved only in this browser ([Offline Mode](../006-document/offline-mode.md)):
the place it lives (the Explorer's This Browser section, beside My Work and the teams), the pill and badge that
mark it, and where a new guest's documents start. A document is **in This Browser**; it is never "Local Only",
"Local Browser" or "offline" in copy. "Offline Mode" stays the name of the feature, and code may say `offline`.

## Names in a sentence

Copy that builds a phrase around a name (a page kind, a template, a chart type, an element type in an agent's
error) takes its article from the name: `withArticle` / `indefiniteArticle` in `../packages/model-core/src/indefinite-article.ts`
(exported by `@livedocuments/document`). A vowel sound takes "an" ("Add an infographic page", "Create an Article"),
and a vowel said "you" keeps "a" ("a User Persona"). A fixed "a" before an interpolated name is how "Create a Org
Chart" once reached livediagram's marketing site.
