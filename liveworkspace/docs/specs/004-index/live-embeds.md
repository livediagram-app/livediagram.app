# Live embeds

A **live embed** shows one item from any app, live and read-only, inside an item of another (Work Tracker 930): a
liveplanner plan on a livedocuments slide, a livediagram architecture on a livedesign page. It is an element of the
host, drawn where it sits on the canvas, and it follows every change to the item as its people make it. Where a
[connected tab](connected-tabs.md) only goes to the item, a live embed shows it in place.

The platform holds the part every app would otherwise build again: who may see an embedded item, the one-minute
ticket that opens it in a frame, and the rules that keep a host's content free of any way in. What the element looks
like in each host is that app's spec (`<app>/docs/specs/013-workspace/embeds.md` "Live embeds"); the frame each target
app serves is its [workbench embed](../011-workbench/workbench.md), opened at the view level.

## Names

- The **host** is the item holding the element; the **target** is the item it shows. Hosts: livediagram, livedocuments
  and livedesign (their Embed element). Targets: livediagram, liveplanner, livedocuments and livedesign
  (`LIVE_EMBED_APPS`), the apps that serve a workbench frame. livehuddle is neither: it has no workbench.
- The **link** is what the host keeps on the element: `liveItem = {app, itemId}`, the target's app and index item id.
  Nothing in it is secret, and it opens nothing by itself.
- The **snapshot** is what the host keeps beside the link, so the element draws without the target: `liveName` (the
  target's name when it was last seen) and `livePoster` (its picture then, a small raster image).
- An **embed ticket** is a [workbench ticket](../011-workbench/workbench.md#live-embed-tickets) minted for one reader,
  for one target, at the view level, bound to the host app's origin. The frame redeems it for an **embed session**.

## Each reader's own access

Owner decision (Work Tracker 930, the same answer as [sheet sources](sheet-sources.md)): a live embed opens with **each
reader's own access to the target**, never a pass. A person who can open the target (its owner, a joined member of its
team, or someone who opened a live link to it) sees it live; anyone else sees the snapshot made unreadable, "Ask its owner to share it
with you" and **Open in <App>**, and never the target's content.

- The ticket is minted with the reader's own token, on the host app's address, and the workbench service asks the index
  for the reader's own grant on the target (the access rule), as it does for any workbench ticket. A share code the
  reader holds for the host gives nothing on the target.
- The level is always **view**, whatever the reader's own level: an embed is for reading. Opening the target to work
  on it is **Open**, in its own app.
- Nothing widens without a click. Making an embed mints no share link, and an embed never lets a reader of the host
  reach a target they could not already open.

## Making one

An Editor of the host (whoever may set an embed's link there) makes a live embed from the Embed element's **Live Embed** tile (or turns an empty embed into
one) and picks the target in **Choose a File**:

- **Connected**: the files this host's connected tabs stand for, first.
- **Recent**: the person's Recent across the apps (the index's Recent), the host left out; a file of an app that
  serves no frame is listed, dimmed, with why.
- **Paste a share link**: any share link of a target app. The editor resolves it through the index
  (`GET /api/index/share/:code`, as opening it would, which records it under the person's Shared), keeps the item's id
  and drops the code at once. A link with a share password asks the person to open it once first; a revoked or unknown
  link says so.

Picking a file writes the link and a fresh snapshot (the target's name and its preview,
`GET /api/previews/items/:id`, drawn small, below). Choosing again replaces both.

## What a reader sees

| The reader                                          | Shown                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Can open the target, the element on screen          | The target live, read-only, in its app's frame                                 |
| Can open it, the element off screen or over the cap | The snapshot, with the target's app logo and name                              |
| The page is itself framed                           | The snapshot, with the name and Open ([The frame](#the-frame))                 |
| Cannot open it (no access, or signed out)           | The snapshot unreadable, "You don't have access to <name>.", **Open in <App>** |
| The target is in the Trash, or gone                 | "This file is no longer there." (an Editor: "Double-click to choose another")  |
| Offline, or the ticket could not be had             | The snapshot, "<name> could not be shown just now.", **Try Again**             |
| A Community copy, or a Community visitor            | The snapshot alone, with no app or item named and no way to open it            |

**Open** (and **Open in <App>** on the no-access card) opens the target at its own address in its own app, in a new
browser tab, at whatever the reader's own access gives there: signed out, its sign-in; signed in without access, the
app's not-found page. No app has a way to ask for access yet, so the card says what to do ("Ask its owner to share it
with you") rather than offering a request it cannot make. The host sends the owner nothing.

For a reader without access the snapshot is unreadable, not just dimmed: drawn with a 24 px blur (wider than any letter
of a poster at most 480 px wide), so no title or card on it can be read. Readers who can open the target, while the
frame is loading or after a failure, see it clear or lightly dimmed.

**Use the file** and **Open** sit in a row just above the element's top left, outside the target's own content, shown
on hover or focus, and counter-scaled like the canvas's other on-element chrome so they are one size on screen (28 px)
at any zoom.

## Loading only on screen

A frame is a whole app, so the host keeps their number small:

- An embed asks for a ticket only while at least `LIVE_EMBED_VISIBLE_RATIO` (10%) of it is in view, after
  `LIVE_EMBED_SETTLE_MS` (400 ms) there, so a fling past it asks nothing.
- At most `LIVE_EMBEDS_MAX` (3) frames are live in one page at once. The rest show their snapshot and take a place as one
  leaves, in the order they came on screen.
- An embed that leaves the screen gives its frame up after `LIVE_EMBED_UNLOAD_MS` (2 s), so a small scroll back keeps it.
- Tickets are limited per person (the workbench service's limiter) and an embed session lives
  `LIVE_EMBED_SESSION_TTL_MS` (30 minutes), renewed through the host while it stays live.

## The frame

The host frames `<target origin>/embed/workbench?d=<itemId>#ticket=<ticket>`: the target app's own workbench page, which
redeems the ticket, binds to the host's origin and shows the item at the view level ([workbench embeds](../011-workbench/workbench.md)).
The host answers the frame's messages as its workbench: `<app>:hello` with `<app>:hello-ack` (named after the host
app), and `<app>:renew` with a fresh ticket (`<app>:ticket`), minted again with the reader's own access, so a reader
who loses access loses the frame at the next renewal at the latest. Messages from any other origin, or any other frame,
are ignored. The frame takes no pointer until the reader turns on **Use the file**, so the host's canvas still drags,
selects and pans over it. The frame is sandboxed without top navigation, so it can never move the host's tab.

Embeds never nest: a live embed on a page that is itself framed (a live embed's own frame, a share-code embed, a
workbench) shows its snapshot and Open only, so two files embedding each other never open frames without end.

## Snapshots: exports, copies and Community

- **Exports draw the snapshot.** An image, PDF or SVG export, a thumbnail and every server render draw `livePoster`
  (or the embed's plain card, as any embed exports, when there is none). JSON exports, copies and offline copies keep the
  link: it is not secret, and it opens nothing for a reader without their own access.
- **Community copies and Community visitors** get the snapshot without the link: `liveItem` is dropped
  (`redactElementsForCommunity`), so a stranger is told of no other item, and nothing can open it.
- **Agents** read the element as it is stored (the link and the name; the link is no secret) and cannot make one:
  choosing a file is the editor's, where the person's own access is at hand.
- **No pass code lands anywhere.** No share code is stored on the element, in a snapshot, in an export, in a copy, in a
  Community post or in an agent's read. A pasted link's code is used once to find the item and dropped.

## The snapshot picture

`livePoster` is a `data:image/webp` (or `image/jpeg`) URL of the target's preview, drawn at most
`LIVE_POSTER_MAX_EDGE` (480) pixels on its longer side and at most `LIVE_POSTER_MAX_CHARS` (60,000) characters, else
left out. It is drawn in the person's appearance when they chose the file, and choosing the file again draws it
afresh. Only `data:image/webp`, `data:image/jpeg` and `data:image/png`
are kept; anything else (an SVG, any other URL) is refused by validation, so a poster can never carry a script.

## Security

- **The reader's own access, every time.** A ticket is minted for the person asking, on their own grant on the target,
  at the view level. A host's share link, its Community link, an API token, a workbench session and the Drive mirror
  mint nothing.
- **The ticket is bound to the host's origin.** The body names the page's origin; the service takes only an app
  origin of this environment (any loopback origin in development). The frame mounts only for that parent, so another
  site cannot frame a reader's embed.
- **No new standing access.** An embed session is a view-level workbench session that lives 30 minutes; it is never
  listed as a pairing, and ending the person's account ends it.
- **Validation keeps the link and the snapshot narrow.** `liveItem` is exactly `{app, itemId}`, `app` one of
  `LIVE_EMBED_APPS`; `liveName` is at most 200 characters; `livePoster` is a raster data URL under the cap.

## Telemetry

Each host counts, under its own app: `Element·Added·LiveEmbed` (a file chosen) and `Canvas·Used·LiveEmbed` (a frame
went live). Never a name, an id or an app.
