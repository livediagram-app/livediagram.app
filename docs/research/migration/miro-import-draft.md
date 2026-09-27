# Miro import (proposed spec)

Status: **proposed**, not yet a spec. Promote into
`docs/specs/020-import-export/` once the open questions are answered.
Evidence: [Migration readiness, section B](../migration-readiness.md#b-miro-board-import).
Builds on [Import pipeline (proposed spec)](./import-pipeline-draft.md).

## What it is

An **Import from Miro** entry in the Import dialog. The user connects Miro once
per session, picks a board from a list, and gets a new livediagram diagram with a
report of what came across. It works on every Miro plan, because it uses the
documented REST API v2 rather than a file export (no plan offers a structured
per-board file for ordinary users).

## Connecting

- Miro app: one app in a livediagram-owned Miro developer team, distributed by
  its installation URL. No Marketplace listing in v1.
- Scope: `boards:read` only.
- Flow: authorisation code in a popup opened from the click. The user picks
  the **team** to install into, Miro redirects to the api Worker route
  `GET /api/import/miro/callback`, which checks the `state` value (random, bound
  to the opener), exchanges the code with the client secret, and returns a
  small page that `postMessage`s the access token (60 minutes) and refresh
  token to the opener, targeted at the livediagram origin only, then closes.
  Nothing is stored in D1; the Worker is stateless.
- Every board, item, connector and image call then goes **browser to
  `api.miro.com`** (CORS `*`, verified).
- A board in another Miro team needs another connection (tokens are per team).
- Self-host: the Miro option shows only when `MIRO_CLIENT_ID` and
  `MIRO_CLIENT_SECRET` are set on the api Worker; otherwise it is absent.

## Reading a board

1. `GET /v2/boards` (cursor pages) for the picker: name, thumbnail, modified.
2. `GET /v2/boards/{id}/items?limit=50` until no cursor; `GET
/v2/boards/{id}/connectors`; `GET /v2-experimental/boards/{id}/mindmap_nodes`.
3. Respect `X-RateLimit-Remaining`; on `429` back off until `X-RateLimit-Reset`.
   A 2,000-item board is about 45 Level-2 calls, well under the 1,000 per
   minute a user gets.

## Mapping

Positions are item centres relative to the board centre, or to the parent
frame's top-left when `position.relativeTo` is `parent_top_left`; the parser
resolves absolute top-left coordinates before mapping.

| Miro                                                                        | livediagram                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sticky note                                                                 | `sticky` with the nearest palette colour; HTML content to text with line breaks                                                                                                                         |
| shape                                                                       | `shape` with the nearest kind (rectangle, round rectangle, circle, rhombus to diamond, triangle ...); unmapped kinds become a rectangle and count as degraded                                           |
| text                                                                        | `text`; bold, italic, links kept where the element supports them                                                                                                                                        |
| frame                                                                       | `shape: 'frame'` with its title; children keep their places                                                                                                                                             |
| connector                                                                   | `arrow` pinned to both items at the nearest anchor to Miro's relative snap point; `straight`, `elbowed`, `curved` map to the matching arrow style; caps map to arrowheads; captions become arrow labels |
| connector with `isSupported: false`                                         | arrow between the two items without waypoints, counted as degraded; skipped when an end has no item                                                                                                     |
| image                                                                       | `image`, bytes from `imageUrl` with `format=original`, through the asset stage                                                                                                                          |
| card, app card                                                              | `sticky` with the title bold and the description below; degraded                                                                                                                                        |
| embed                                                                       | `link-card` with the embed's URL and title                                                                                                                                                              |
| document, doc format                                                        | `link-card` pointing at Miro when a URL exists, else skipped                                                                                                                                            |
| mind map node                                                               | `mind-node` tree under its root                                                                                                                                                                         |
| code widget                                                                 | code block                                                                                                                                                                                              |
| group                                                                       | dropped (livediagram has no groups); members import individually                                                                                                                                        |
| pen strokes, link previews, tables, kanban, mockups, emoji, user story maps | **skipped**, named and counted in the report                                                                                                                                                            |

## Images

The `imageUrl` call with `redirect=false` returns a URL valid for 60 seconds.
If that URL is readable cross-origin (experiment E-B1), the browser fetches the
bytes directly. If not, `GET /api/import/miro/image?url=` on the api Worker
streams them through, restricted to Miro's resource hosts, signed-in or guest
owner only, rate-limited per owner. Either way the asset stage resizes and
uploads as usual.

## Cost

One Worker request per connection (code exchange), plus one per image only if
the pass-through is needed. At 10M users and a one-off import of 50 images each
by 5%, that is about 25M requests once, roughly $8 of Worker requests.

## Errors

- Consent denied or closed: the dialog returns to the source list with
  "Miro did not grant access".
- Token expired mid-import: refresh once from the tab's refresh token, then ask
  to reconnect.
- Board without permission (`403`) or deleted (`404`): named in the picker,
  import not started.
- Empty board: an empty diagram is not created; the dialog says the board has
  no items.

## Open questions

1. **Clipboard route.** Miro's clipboard carries the whole board, pen strokes
   and link previews included, behind a base64 and byte-shift obfuscation
   (third-party reverse engineering). Adding a "paste from Miro" path would
   recover what REST loses, at zero server cost, but Miro's Terms of Service
   (2.9 d) forbid reverse engineering "except to the extent expressly permitted
   by Law (and then only with prior notice to Miro)". Needs a decision, and
   probably advice, before any code.
2. Marketplace listing for discovery later, or installation URL only?
3. Card and app card: sticky (as above) or a richer element?
