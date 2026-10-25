# Share-link previews

**Status: built.**

When a share link is pasted into Slack, Teams, Discord, iMessage, WhatsApp, X, LinkedIn or anything else that
draws a link preview, the preview names the design and shows a picture of it. A link that is not a working,
open share link previews as livedesign itself, with the brand card.

## Why

A link preview is read by a crawler that never runs the page's script. The editor is one static shell for every
design ([New design route](../007-editor/new-design-route.md)), so its `<head>` named no design and carried
no image: every pasted link showed "livedesign" and the tagline over an empty box, and a channel full of links
gave nobody a reason to tell them apart or click.

## What a preview shows

| Link                                                                | Title             | Description        | Image                  |
| ------------------------------------------------------------------- | ----------------- | ------------------ | ---------------------- |
| A working share link (`/design/shared?s=<code>`), no share password | The design's name | The share pitch    | The share card (below) |
| A share link to a design with a share password                      | livedesign        | The editor's pitch | The brand card         |
| An unknown, revoked or expired code; a trashed design               | livedesign        | The editor's pitch | The brand card         |
| Any other editor address (`/design/<id>`, the Explorer, ...)        | livedesign        | The editor's pitch | The brand card         |

- **The share pitch** is `Open it in livedesign: logos, wireframes and photos, made together.`
- **The editor's pitch** is the editor's own description, unchanged.
- **The brand card** is the origin's shared Open Graph image (`/opengraph-image`, `/twitter-image`), the one the
  marketing site and the help centre use.
- A design's own address (`/design/<id>`) only opens for its owner, so its preview never names the design:
  a private link pasted in a public channel tells the channel nothing.

## The share card

`GET /api/share/<code>/image.png`: a 1200 × 630 PNG, the size every preview surface draws at full width. It is
liveworkspace's, built once for every app ([Previews](../../../../liveworkspace/docs/previews.md)): the router sends
the address to the media service, which draws the card from the design's preview and caches it. livedesign only
renders for the platform: its export door draws the design's SVG
([Design SVG snapshots](../006-design/design-snapshots.md) "What livedesign draws").

- **The picture is the live image's.** The same tab, the same rules: a tab-scoped link's own tab, otherwise the
  first tab ([Live image share link](live-image-share.md)), fitted inside the card, never stretched or cropped.
- **Nothing to draw**: the request is redirected (302) to the brand card, so the preview still has a picture.
- **Withheld exactly where the live image is**: a password-protected design, an unknown, revoked or expired code
  and a trashed design answer 404, as the index decides, and the page names none of them.

## The share page's head

The live app's worker fills in the shell's `<head>` for `/design/shared?s=<code>` before it is sent: the
`<title>`, `description`, `og:title`, `og:description`, `og:image` (with its alt text), `twitter:title`,
`twitter:description` and `twitter:image`. The head is liveworkspace's too (`@liveworkspace/media`
`createSharePage`): livedesign gives it only its share page's address and its words. It asks liveworkspace's
previews for the link's name with `GET /api/previews/share/<code>/card` (at `PREVIEWS_ORIGIN`, production's
https://liveworkspace.app unless set), which answers `{ name }` for a link whose preview names its design and 404
for every other row of the table above.

- **The shell is fetched at the same time as the card**, so a visitor waits for whichever is slower, not both.
- **The service has 1.5 s.** Slower or failing: the shell goes out as built, with the brand card, and the editor
  works as before.
- **The editor still sets its own title** once the design loads; the worker only decides what a crawler reads.

## Share roles

A preview is not a session feature: no Editor, Participant or Viewer action reaches it, and it shows the same to
every role. What it reveals (the name and the picture the link's live image already serves) is less than a Viewer
of that link sees, so it needs no gate beyond the link's own.

## Limits and abuse

The card, the share card and the live image are the media service's to limit and cache
([Previews](../../../../liveworkspace/docs/previews.md)); each answers only what the live image already answers for
the same code, so none adds a way to learn more from a guessed code. The live worker passes the visitor's address on,
so a limit applies per visitor, not to the live worker as one caller.
