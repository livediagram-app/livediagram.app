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

`GET /api/share/<code>/image.png`: a 1200 × 630 PNG, the size every preview surface draws at full width. It is
liveworkspace's, built once for every app ([previews.md](../../../../liveworkspace/docs/specs/006-media/previews.md) "The addresses"): liveplanner's router
forwards the address to the previews service, which draws the card from the plan's drawing (the live image's: the
same tab, the same rules, [Live image share link](live-image-share.md)), stores it until the plan is saved again, and
redirects (302) to the brand card when there is nothing to draw. A password-protected project, an unknown, revoked or
expired code and a trashed project answer 404, exactly where the live image does. liveplanner only draws the tab when
asked ([Project previews](../006-project/project-snapshots.md)).

## The share page's head

The editor app's worker fills in the shell's `<head>` for `/project/shared?s=<code>` before it is sent: the
`<title>`, `description`, `og:title`, `og:description`, `og:image` (with its alt text), `twitter:title`,
`twitter:description` and `twitter:image`. The rewrite is liveworkspace's, the same in every app
(`@liveworkspace/media` `createSharePage`, [previews.md](../../../../liveworkspace/docs/specs/006-media/previews.md) "The share page's head"); liveplanner's
`apps/editor/src/share-page.ts` gives only its words: the share page's addresses, the share pitch and "Untitled plan".
It asks liveworkspace's previews for the link's name with `GET /api/previews/share/<code>/card` (at
`https://www.liveworkspace.app`, or the editor's `PREVIEWS_ORIGIN`: staging's own), which answers `{ name }` for a link
whose preview names its project and 404 for every other row of the table above.

- **The shell is fetched at the same time as the card**, so a visitor waits for whichever is slower, not both.
- **The service has 1.5 s.** Slower or failing: the shell goes out as built, with the brand card, and the editor works
  as before.
- **The editor still sets its own title** once the project loads; the worker only decides what a crawler reads.

## Share roles

A preview is not a session feature: no Editor, Participant or Viewer action reaches it, and it shows the same to
every role. What it reveals (the name and the picture the link's live image already serves) is less than a Viewer
of that link sees, so it needs no gate beyond the link's own.

## Limits and abuse

- The previews never reach liveplanner's api, so they spend nothing of its share resolve's per-network budget on
  `SHARE_RATE_LIMITER`. Each door answers only what the live image already answers for the same code, so a guessed
  code learns nothing more from them.
- The editor worker passes the visitor's address on to the service, so it sees visitors rather than the editor worker
  as one caller.
- The card is drawn at most once per save per project and tab, and the PNG's longer side is never more than 1200 px,
  so a vast board cannot exhaust a Worker's memory.
