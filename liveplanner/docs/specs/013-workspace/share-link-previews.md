# Share-link previews

**Status: built.**

> The shared Share dialog (`@liveworkspace/explorer`) copies a link as `/project/shared?s=<code>`
> (`shareUrl` in `apps/editor/lib/explorer-host.ts`), the address whose head is filled in below, so a copied link
> previews as its plan.

When a share link is pasted into Slack, Teams, Discord, iMessage, WhatsApp, X, LinkedIn or anything else that
draws a link preview, the preview names the project and shows a picture of it. A link that is not a working,
open share link previews as liveplanner itself, with the brand card.

## Why

A link preview is read by a crawler that never runs the page's script. The editor is one static shell for every
project ([New project route](../007-editor/new-project-route.md)), so its `<head>` named no project and carried
no image: every pasted link showed "liveplanner" and the tagline over an empty box, and a channel full of links
gave nobody a reason to tell them apart or click.

## What a preview shows

| Link                                                                 | Title              | Description        | Image                  |
| -------------------------------------------------------------------- | ------------------ | ------------------ | ---------------------- |
| A working share link (`/project/shared?s=<code>`), no share password | The project's name | The share pitch    | The share card (below) |
| A share link to a project with a share password                      | liveplanner        | The editor's pitch | The brand card         |
| An unknown, revoked or expired code; a trashed project               | liveplanner        | The editor's pitch | The brand card         |
| Any other editor address (`/project/<id>`, the Explorer, ...)        | liveplanner        | The editor's pitch | The brand card         |

- **The share pitch** is `Open it in liveplanner: boards, sheets, dashboards and forms, planned together in real time.` (the site's `SITE_PITCH`)
- **The editor's pitch** is the editor's own description, unchanged.
- **The brand card** is the origin's shared Open Graph image (`/opengraph-image`, `/twitter-image`), the one the
  marketing site and the help centre use.
- A project's own address (`/project/<id>`) only opens for its owner, so its preview never names the project:
  a private link pasted in a public channel tells the channel nothing.

## The share card

`GET /api/share/<code>/image.png`: a 1200 × 630 PNG, the size every preview surface draws at full width.

- **The picture is the live image's.** The same tab, the same rules: a tab-scoped link's own tab, otherwise the
  first tab ([Live image share link](live-image-share.md)). The drawing is fitted inside the card with 48 px of margin, centred,
  never stretched or cropped, on the drawing's own background colour. A small drawing grows to
  at most twice its size, so a single box never reads as a blown-up blob.
- **Nothing to draw** (an empty first tab, no image store on the deployment): the request is redirected (302) to the
  brand card, so the preview still has a picture.
- **Withheld exactly where the live image is**: a password-protected project, an unknown, revoked or expired code
  and a trashed project answer 404, and the page names none of them.
- **Cached in R2** beside the snapshots: `og/<projectId>` for the first tab, stamped with the time it was drawn and redrawn when the project has been saved since. A
  tab-scoped link's card is drawn per request and not stored, as its tab's live image is. Deleting a project
  deletes it with its snapshots.
- **Drawn by the shared resvg renderer** (`@liveplanner/render-png/worker`, the MCP server's), with Inter as the
  one font, so a card's text matches the MCP previews.
- **Served** `Cache-Control: public, max-age=300, stale-while-revalidate=3600`.

## The share page's head

The editor app's worker fills in the shell's `<head>` for `/project/shared?s=<code>` before it is sent: the
`<title>`, `description`, `og:title`, `og:description`, `og:image` (with its size and alt text), `twitter:title`,
`twitter:description` and `twitter:image`. It asks the api for the link's preview with
`GET /api/share/<code>/card`, which answers `{ name }` for a link whose preview names its project and 404 for every
other row of the table above.

- **The shell is fetched at the same time as the card**, so a visitor waits for whichever is slower, not both.
- **The api has 1.5 s.** Slower, failing, or not bound at all (a deployment without the `API` service binding): the
  shell goes out as built, with the brand card, and the editor works as before.
- **The editor still sets its own title** once the project loads; the worker only decides what a crawler reads.

## Share roles

A preview is not a session feature: no Editor, Participant or Viewer action reaches it, and it shows the same to
every role. What it reveals (the name and the picture the link's live image already serves) is less than a Viewer
of that link sees, so it needs no gate beyond the link's own.

## Limits and abuse

- The card and the share card share one per-network bucket on `SHARE_RATE_LIMITER` (key `share-preview:<network>`),
  apart from the share resolve's, so an office opening a link together in a meeting never spends the editor's own
  budget on previews. Both doors answer only what the live image already answers for the same code, so the bucket
  adds no way to learn more from a guessed code.
- The editor worker forwards the visitor's `CF-Connecting-IP` to the api, so the limit applies per visitor, not to
  the editor worker as one caller.
- The card is drawn at most once per save per project (its first tab), and the PNG's longer side is never
  more than 1200 px, so a vast board cannot exhaust a Worker's memory.
