# Miro import

A **Miro** format card in the Import dialog. The user connects Miro, picks a
board, and its contents replace the current tab, with a report of what came
across and what did not. It uses Miro's documented REST API v2 only, so it
works on every Miro plan (no plan offers ordinary users a structured per-board
file). Built on [Board import](board-import.md); evidence in
[Migration readiness, section B](../../research/migration-readiness.md#b-miro-board-import).

## Decisions

- **REST API only.** The Miro clipboard carries more (pen strokes, link
  previews), but decoding it means reverse engineering an undocumented format,
  which Miro's Terms of Service (2.9 d) and Developer Terms (3.3 g) forbid.
  livediagram does not do it. What REST cannot read is reported, not guessed.
- **No stored Miro credentials.** The api Worker only exchanges the one-time
  code; tokens live in the tab for the session.

## Connecting

- One Miro app in a livediagram-owned developer team, distributed by its
  installation URL. No Marketplace listing.
- Scope: `boards:read`.
- The click on **Connect Miro** opens Miro's consent page in a popup. The user
  picks the **team** to install into. Miro redirects to
  `GET /api/import/miro/callback` on the api Worker, which checks `state`
  (random, bound to the opener), exchanges the code with the client secret, and
  returns a page that `postMessage`s the access token (60 minutes) and refresh
  token to the opener, targeted at the livediagram origin only, then closes.
  Nothing is written to D1.
- Every later call goes **browser to `api.miro.com`** (CORS `*`). An expired
  access token is refreshed once from the tab through
  `POST /api/import/miro/refresh` (same statelessness); a second failure asks
  the user to reconnect.
- Boards in another Miro team need another connection; tokens are per team.
- Self-host: the card shows only when the api Worker has `MIRO_CLIENT_ID` and
  `MIRO_CLIENT_SECRET`; both routes answer `404` otherwise.

## Reading a board

1. `GET /v2/boards` (cursor pages) fills the picker: name, modified date.
2. `GET /v2/boards/{id}/items?limit=50` until there is no cursor, then
   `GET /v2/boards/{id}/connectors` (connectors are not in `/items`) and
   `GET /v2-experimental/boards/{id}/mindmap_nodes`.
3. `429` or a low `X-RateLimit-Remaining` pauses until `X-RateLimit-Reset`. A
   2,000-item board is about 45 Level-2 calls; a user may make 1,000 a minute.

## Mapping

Positions are item centres, relative to the board centre or, when
`position.relativeTo` is `parent_top_left`, to the parent frame's top-left
corner; the parser resolves absolute top-left coordinates first.

| Miro                                                                                     | livediagram                                                                                                                                                                              | Outcome                                                        |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| sticky note                                                                              | `sticky`, nearest palette colour; HTML content to text with line breaks                                                                                                                  | imported                                                       |
| shape                                                                                    | `shape` of the nearest kind (rectangle, round rectangle, circle, rhombus to diamond, triangle, and so on)                                                                                | imported, or degraded to a rectangle for kinds without a match |
| text                                                                                     | `text`; bold, italic and links kept where the element supports them                                                                                                                      | imported                                                       |
| frame                                                                                    | `shape: 'frame'` with its title; children keep their places                                                                                                                              | imported                                                       |
| connector                                                                                | `arrow` pinned to both items at the anchor nearest Miro's relative snap point; `straight`, `elbowed`, `curved` to the matching arrow style; caps to arrowheads; captions to arrow labels | imported                                                       |
| connector, `isSupported: false`                                                          | straight `arrow` between its two items, no waypoints                                                                                                                                     | degraded; skipped when an end has no item                      |
| image                                                                                    | `image`, bytes from `imageUrl` with `format=original`, through the asset stage                                                                                                           | imported                                                       |
| card, app card                                                                           | `sticky`, title in bold over the description                                                                                                                                             | degraded                                                       |
| embed                                                                                    | `link-card` with the embed's URL and title                                                                                                                                               | imported                                                       |
| document, doc format                                                                     | `link-card` to the board item when Miro gives a URL                                                                                                                                      | degraded, or skipped without a URL                             |
| mind map node                                                                            | `mind-node` tree under its root                                                                                                                                                          | imported                                                       |
| code widget                                                                              | code block                                                                                                                                                                               | imported                                                       |
| group                                                                                    | members import individually (livediagram has no groups)                                                                                                                                  | degraded                                                       |
| pen stroke, link preview, table, kanban, mockup, emoji, user story map, any unknown type | nothing                                                                                                                                                                                  | skipped, named and counted                                     |

## Images

`imageUrl` with `redirect=false` returns a URL valid for 60 seconds. The browser
fetches it directly when that URL allows cross-origin reads; otherwise
`GET /api/import/miro/image?url=` on the api Worker streams the bytes, only for
Miro's resource hosts, rate-limited per owner. Either way the asset stage
resizes and uploads.

## Errors

- Consent denied or popup closed: the card returns to its idle state with
  "Miro did not grant access."
- Board without permission (`403`) or gone (`404`): named in the picker; the
  import does not start.
- Empty board: nothing is committed; the panel says the board has no items.
- A failure after reading starts leaves the tab untouched: commit happens only
  once parsing succeeds.

## Cost

One Worker request per connection and per token refresh, plus one per image
only if the pass-through is needed. A one-off import of 50 images by 5% of 10M
users is about 25M requests, roughly $8.

## Non-goals

- The clipboard, the `.rtb` backup and the Enterprise Board Export API.
- Comments, tags and board members.
- A Miro Marketplace listing.
