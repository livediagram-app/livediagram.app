# From new to first edit

The first minute decides whether a new person stays. Every editor (livediagram, liveplanner, livedocuments, livedesign,
livehuddle, liveknowledge) keeps the path from **`/new`** and from a **share link** to the person's first real edit as
short as it can be, and teaches by example on the way: never with a blocking tour (the coach-dock tour stays declined).
This spec holds the rules the six share; each product's `new-*-route.md` holds its own `/new` and the measured numbers
are in [The baseline](#the-baseline) below (Work Tracker 1436).

## The rules

- **`/new` asks nothing.** It makes the item where items go by default and opens it on its start in place, as each
  product's `new-*-route.md` says. A creation step that only asks what has a later, better home (name, store, folder,
  theme) is not added back.
- **The first edit is one press from `/new`.** An Editor's empty tab opens on its start: the product's templates, each
  a real piece of work to build on (starter content), with a blank one closing the start. Closed, the start leaves a
  palette tray with Show Templates (`StartAgainTray`), so the choice stays one click away.
- **A share link opens straight on the item.** Nothing stands between a visitor and the item: no card to dismiss
  before the first edit ([A visitor's name](#a-visitors-name)).
- **Empty states teach by example.** An Editor's empty tab is its start (or, closed, the Show Templates tray). A
  Participant's or Viewer's empty tab shows the **empty-canvas card** in every editor
  ([The empty-canvas card](#the-empty-canvas-card)). Both are inline and dismissible, never a tour or a modal.
- **No app gets slower.** A change to one of these paths is measured before and after ([The baseline](#the-baseline))
  and the after numbers sit beside the before ones in its PR.

## A visitor's name

A visitor's name is **defaulted, not asked**. A guest arriving by a share link, or opening an item shared with them
before they have ever confirmed a name, joins straight away under the name they already have: their liveworkspace
profile's, which a first visit seeds with a random placeholder (`firstVisitName`, "Clever Marlin"). The choice stays one
click away:

- **The name tray.** While the visitor has not confirmed a name, a palette tray hangs from the strip, as every standing
  tray does: a person glyph, "You're **Clever Marlin** here", then **Change Name** and **Keep It**. Without a strip on
  screen (a Viewer has no Palette, Draw's dock) it is the same card at the top centre, below the top chrome. On a phone
  the sentence is for screen readers and the two actions show (the tray's width holds only those).
- **Change Name** opens the name card (`IdentityPrompt`, unchanged: the name field, the shuffle, Join and Cancel) over
  the canvas. Join keeps the typed name, Cancel the one they had; either confirms the name.
- **Keep It** confirms the name as it is. Either way the tray goes and does not come back in this browser (the
  product's `<product>:v2:name-confirmed` flag, as Join set before).
- **Editing confirms nothing by itself.** The tray stays while the visitor works, so they can rename after their
  first edit; it steps aside while a mode's message (an armed tool's Cancel) takes the same slot.
- **A signed-in visitor** is named by their account, locked, so there is nothing to choose: no tray and no card.
- **An owner** never sees either: `/new` confirms the name of whoever makes an item.
- **Embeds, workbenches and Community posts** show neither, as before.

Why: the card hid every toolbar until it was answered and asked a question with an obvious default. Measured, it was
one of the four presses a guest needed from a share link to a first shape, and the only one that was not the edit
itself ([The baseline](#the-baseline)). A random name a person can change on the spot costs less than a gate every
visitor must pass; the share roles are unchanged ([Share roles](#share-roles)).

## The empty-canvas card

One card for every editor (`EmptyCanvasCard` in `@liveworkspace/workbench`): a calm card in the middle of an empty
tab, its small picture of what the product makes in the brand's tints, "<Tab> is empty" (15 px semibold), and one line,
in full. Only the card takes presses; the canvas around it still pans. Its × closes it for good on that tab for this
person in this browser (the shared `empty-card-dismissed` list), and it goes once the tab has content. On a phone it is
narrower (18rem); on a screen 480 px tall or less it drops the picture. Each product supplies the picture, the line and
whether its desktop card offers Help (an Editor's only).

- **Who sees it:** a Participant or Viewer, on an empty tab, in every editor. An Editor sees the start instead
  (livediagram, livehuddle: an Editor whose start is closed in a mode without a tray sees the card with "Add an element
  from the Palette").
- **Its line:** a Viewer reads "Nothing here yet. The owner can build it out, and your view updates live." A
  Participant reads what they may add where the product lets them add something (livediagram: a sticky, text or an
  image), else the Viewer's line.
- **Where it does not show:** zen, an embed, a connected tab, while a draw tool is armed, and livediagram's Draw mode
  (its dock is the hint). liveknowledge shows it on an empty canvas tab, not on a page (a page's read view is its own).
- **Each product's line:** livedocuments and liveknowledge give every non-Editor the Viewer's line (a Participant
  comments and votes there; they add no pages). livedesign and liveplanner give a Participant "Nothing here yet. Add a
  sticky, text or an image from the Palette to get it going."
- **Beside a standing tray:** the name tray goes first among the trays under the strip; the template example tray and
  Show Templates step aside while it shows (`[data-standing-first]`).

## Share roles

Nothing here changes what a role may do. The name tray and card write only the visitor's own profile, so an Editor, a
Participant and a Viewer each get them alike (a Viewer's card words promise no editing, as before). The empty-canvas
card is a Participant's and a Viewer's; an Editor's empty tab is its start.

## The baseline

Measured on a local verifier stack (dev servers, a fresh browser each run, a guest), driven by Playwright at machine
speed: clicks the person makes and seconds from opening the address to the edit being on screen. The first edit from
`/new` is a template from the start; from a share link (Editor pass) it is the product's own first piece of content
(livediagram: Shapes, Square, a press on the canvas). Desktop is 1440 by 900, phone 390 by 844 with touch. The script
waits a fixed 2 to 3 seconds between steps in both runs, so the seconds compare before with after rather than give
an absolute.

| App         | Path       | View    | Before: clicks, seconds | After: clicks, seconds |
| ----------- | ---------- | ------- | ----------------------- | ---------------------- |
| livediagram | `/new`     | desktop | 1, 2.0                  | see the PR             |
| livediagram | `/new`     | phone   | 1, 2.0                  | see the PR             |
| livediagram | share link | desktop | 4, 6.6                  | see the PR             |
| livediagram | share link | phone   | 4, 6.5                  | see the PR             |
