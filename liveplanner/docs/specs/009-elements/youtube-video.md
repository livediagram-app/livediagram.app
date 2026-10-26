# YouTube video element

## What

A **Video** element: a 16:9 card for a YouTube video. In liveplanner it is a model kind: no Plan surface places one,
and one arrives with a tab (an import, a paste). Its link is set from the link picker (a double-click, or the element
menu's Link section), and every export draws its card. The canvas has no player face for it: no poster, no play
button and no iframe, so a video shows as an empty box with its selection ring and its link badge
([Elements](README.md)).

## The element

`VideoElement` (`type: 'video'`) is a boxed element added through the standard
new-type surface, following the `link-card` precedent ([Link cards](link-cards.md)): `isBoxed`,
`createVideo` (480×270, a true 16:9), the `colors.ts` defaults +
`supportsColours`, `element-variant.ts`, `search.ts`, `export-tab.ts`,
`validate.ts`.

**It carries no new data field.** The URL lives in `element.link`
(`{ kind: 'url' }`) exactly as a link card's does, so double-clicking opens the
existing `LinkPickerDialog` and `applyElementLink` commits it: no second URL
editor, no new dialog.

The picker opens **restricted**, though. A link card can legitimately point at
a tab or another project; a video cannot, because its link is not a
destination, it is the content: a video pointed at a tab has nothing to play.
So `LinkPickerDialog` has a `urlOnly` config (caller-supplied copy plus a
validator) which hides the mode switcher entirely and validates as you type:
a non-YouTube URL shows "That isn't a YouTube video link" and Save stays
disabled. The validator runs again at commit, so Enter cannot slip past a
message the user has not read. It runs on the **normalised** URL, so a bare
`youtu.be/...` is judged as the `https://youtu.be/...` that would be stored.

The video id is **parsed at render time** from that link by a pure helper
(`youtubeVideoId` in `../packages/model-core/src/youtube.ts`), never stored. Link
cards cache their preview in `meta` because unfurling costs a network round
trip; parsing an id costs nothing, so caching it would only create a second
copy of the truth that can drift from the link.

**Aspect-locked to 16:9** on resize, like an icon ([Technology icons](../010-palette/technology-icons.md)) and for the same
reason: a letterboxed or stretched video frame is never what anyone wants.

`THEME_COLOUR_FIELDS` gives video an **empty** list: like image and sticky, a
video keeps its own look across themes.

## Accepted URLs

`youtubeVideoId` accepts every form YouTube hands out, and returns `null` for
anything else:

| Form                                        | Example                     |
| ------------------------------------------- | --------------------------- |
| `youtube.com/watch?v=<id>`                  | plus any other query params |
| `youtu.be/<id>`                             | the share-sheet short link  |
| `youtube.com/embed/<id>`                    | someone pasting embed HTML  |
| `youtube.com/shorts/<id>`                   |                             |
| `youtube.com/live/<id>`                     |                             |
| `m.` / `www.` / `music.` hosts, `-nocookie` | all normalised              |

An id is exactly 11 characters of `[A-Za-z0-9_-]`. The host must be a YouTube
host; a query string `?v=` on some other site is not a video. Anything the
parser rejects renders the "not a YouTube link" state rather than an id-shaped
guess.

## Nothing loads

The editor makes no request for a video: no poster image and no player. Opening a project that holds one is not a
visit to YouTube, which matters because liveplanner promises no trackers
([Business model + licence](../002-project-scope/business-model-and-licence.md)). The link badge opens the video on
YouTube in a new tab.

## Export

- **JSON** round-trips through `validate.ts` like any element.
- **SVG / PNG export and the share thumbnail** cannot contain an iframe or a
  cross-origin image, so a video renders as its card with a play glyph and its
  title. That is the honest static representation.
- **Mermaid / Markdown** export it as a link, which is all those formats can
  hold.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

- `Element·Added·Video` on creation, from the shared
  `elementTelemetryType` mapper so copy / paste / duplicate count too.
- No playback event: nothing plays in liveplanner.

## Not in scope

An inline player, start-time offsets, autoplay-on-load (deliberately never), and playlists.
Other providers are specified in [More than YouTube](embed-providers.md).
