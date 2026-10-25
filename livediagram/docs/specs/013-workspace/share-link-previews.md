# Share-link previews

**Status: built.**

When a share link is pasted into Slack, Teams, Discord, iMessage, WhatsApp, X, LinkedIn or anything else that
draws a link preview, the preview names the document and shows a picture of it. A link that is not a working,
open share link previews as livediagram itself, with the brand card.

## Why

A link preview is read by a crawler that never runs the page's script. The editor is one static shell for every
document ([New document route](../007-editor/new-document-route.md)), so its `<head>` named no document and carried
no image: every pasted link showed "livediagram" and the tagline over an empty box, and a channel full of links
gave nobody a reason to tell them apart or click.

## What a preview shows

| Link                                                                  | Title               | Description        | Image                  |
| --------------------------------------------------------------------- | ------------------- | ------------------ | ---------------------- |
| A working share link (`/document/shared?s=<code>`), no share password | The document's name | The share pitch    | The share card (below) |
| A share link to a document with a share password                      | livediagram         | The editor's pitch | The brand card         |
| An unknown, revoked or expired code; a trashed document               | livediagram         | The editor's pitch | The brand card         |
| A Community post's link while the post is not public                  | livediagram         | The editor's pitch | The brand card         |
| Any other editor address (`/document/<id>`, the Explorer, ...)        | livediagram         | The editor's pitch | The brand card         |

- **The share pitch** is `Open it in livediagram: diagrams, whiteboards and documents, made together.`
- **The editor's pitch** is the editor's own description, unchanged.
- **The brand card** is the origin's shared Open Graph image (`/opengraph-image`, `/twitter-image`), the one the
  marketing site and the help centre use.
- A document's own address (`/document/<id>`) only opens for its owner, so its preview never names the document:
  a private link pasted in a public channel tells the channel nothing.

## The share card

`GET /api/share/<code>/image.png`: a 1200 × 630 PNG, the size every preview surface draws at full width. It is
liveworkspace's, built once for every app ([liveworkspace/docs/previews.md](../../../../liveworkspace/docs/previews.md)
"The share card"): this app's router forwards the address to liveworkspace's previews, and livediagram only draws
the picture on it, through its export door ([Document SVG snapshots](../006-document/document-snapshots.md)).

- **The picture is the live image's.** The same tab, the same rules: a tab-scoped link's own tab, otherwise the
  first tab; a Community link's redacted tab ([Live image share link](live-image-share.md),
  [Community](../025-community/community.md)). The drawing is fitted inside the card with 48 px of margin, centred,
  never stretched or cropped, on the drawing's own background colour.
- **Nothing to draw**: the request is redirected (302) to the brand card, so the preview still has a picture.
- **Withheld exactly where the live image is**: a password-protected document, an unknown, revoked or expired code,
  a trashed document and a non-public Community post answer 404, and the page names none of them.
- Stored, refreshed after a save, served and limited by the platform, as every app's are.

## The share page's head

The editor app's worker fills in the shell's `<head>` for `/document/shared?s=<code>` before it is sent: the
`<title>`, `description`, `og:title`, `og:description`, `og:image` (with its size and alt text), `twitter:title`,
`twitter:description` and `twitter:image`. The page head is liveworkspace's too (`createSharePage` in
`@liveworkspace/media`, the same for every app); livediagram gives it only its share page's addresses and its words.
It asks liveworkspace's previews for the link's preview with `GET /api/previews/share/<code>/card` (at
`PREVIEWS_ORIGIN`, production's by default), which answers `{ name }` for a link whose preview names its document
and 404 for every other row of the table above.

- **The shell is fetched at the same time as the card**, so a visitor waits for whichever is slower, not both.
- **The service has 1.5 s.** Slower or failing: the shell goes out as built, with the brand card, and the editor
  works as before.
- **The editor still sets its own title** once the document loads; the worker only decides what a crawler reads.

## Share roles

A preview is not a session feature: no Editor, Participant or Viewer action reaches it, and it shows the same to
every role. What it reveals (the name and the picture the link's live image already serves) is less than a Viewer
of that link sees, so it needs no gate beyond the link's own.

## Limits and abuse

- Both doors answer only what the live image already answers for the same code, so they add no way to learn more
  from a guessed code. Their limits are the platform's ([liveworkspace/docs/previews.md](../../../../liveworkspace/docs/previews.md)
  "Cost and performance").
- The editor worker passes the visitor's address on, so the service sees visitors, not the editor worker as one
  caller.
