# Share-link previews

**Status: built.**

> The shared Share dialog (`@liveworkspace/explorer`) copies a link as `/document/shared?s=<code>`
> (`shareUrl` in `apps/editor/lib/explorer-host.ts`), the address whose head is filled in below, so a copied link
> previews as its document.

When a share link is pasted into Slack, Teams, Discord, iMessage, WhatsApp, X, LinkedIn or anything else that
draws a link preview, the preview names the document and shows a picture of it. A link that is not a working,
open share link previews as livedocuments itself, with the brand card.

## Why

A link preview is read by a crawler that never runs the page's script. The editor is one static shell for every
document ([New document route](../007-editor/new-document-route.md)), so its `<head>` named no document and carried
no image: every pasted link showed "livedocuments" and the tagline over an empty box, and a channel full of links
gave nobody a reason to tell them apart or click.

## What a preview shows

| Link                                                                  | Title               | Description        | Image                  |
| --------------------------------------------------------------------- | ------------------- | ------------------ | ---------------------- |
| A working share link (`/document/shared?s=<code>`), no share password | The document's name | The share pitch    | The share card (below) |
| A share link to a document with a share password                      | livedocuments       | The editor's pitch | The brand card         |
| An unknown, revoked or expired code; a trashed document               | livedocuments       | The editor's pitch | The brand card         |
| Any other editor address (`/document/<id>`, the Explorer, ...)        | livedocuments       | The editor's pitch | The brand card         |

- **The share pitch** is `Open it in livedocuments: articles, slide decks and infographics, made together.`
- **The editor's pitch** is the editor's own description, unchanged.
- **The brand card** is the origin's shared Open Graph image (`/opengraph-image`, `/twitter-image`), the one the
  marketing site and the help centre use.
- A document's own address (`/document/<id>`) only opens for its owner, so its preview never names the document:
  a private link pasted in a public channel tells the channel nothing.

## The share card and the share page's head are liveworkspace's

Both are built once for every app ([Previews](../../../../liveworkspace/docs/previews.md)); livedocuments supplies only
its drawing (the export door, [Document previews](../006-document/document-snapshots.md)) and its words.

- **The share card** is `GET /api/share/<code>/image.png` on this app's address, which the router forwards to
  liveworkspace's previews: a 1200 x 630 PNG of the live image's drawing (a tab-scoped link's own tab, otherwise the
  first tab, [Live image share link](live-image-share.md)), fitted with 48 px of margin, on the drawing's own
  background, grown at most twice. Nothing to draw redirects (302) to the brand card. It is withheld exactly where the
  live image is: a password-protected document, an unknown, revoked or expired code and a trashed document answer 404.
- **The share page's head**: the editor app's worker fills in the shell's `<head>` for `/document/shared?s=<code>`
  through `createSharePage` (`@liveworkspace/media`, `apps/editor/src/share-page.ts` holds only livedocuments' words:
  the share pitch, "Untitled document" and the page addresses). It asks liveworkspace's previews for the link's
  name (`GET /api/previews/share/<code>/card` at `PREVIEWS_ORIGIN`, production's when unset), at the same time as
  the shell, for at most 1.5 s; slower, failing or a 404, the shell goes out as built with the brand card. The
  editor still sets its own title once the document loads.

## Share roles

A preview is not a session feature: no Editor, Participant or Viewer action reaches it, and it shows the same to
every role. What it reveals (the name and the picture the link's live image already serves) is less than a Viewer
of that link sees, so it needs no gate beyond the link's own.

## Limits and abuse

The card, its picture and their caching and limits are the platform's
([Previews](../../../../liveworkspace/docs/previews.md) "Cost"). Both doors answer only what the live image already
answers for the same code, so they add no way to learn more from a guessed code. The api's `SHARE_RATE_LIMITER`
counts only the share resolve itself.
