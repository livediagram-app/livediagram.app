# 114 — YouTube video element

Status: shipped

## What

A **Video** element in the palette's **Media** category (spec/110): a
16:9 card that shows a YouTube video's poster frame and plays it inline when
pressed.

## The element

`VideoElement` (`type: 'video'`) is a boxed element added through the standard
new-type surface, following the `link-card` precedent (spec/40): `isBoxed`,
`createVideo` (480×270, a true 16:9), the `colors.ts` defaults +
`supportsColours`, `element-variant.ts`, `search.ts`, `export-tab.ts`,
`validate.ts`.

**It carries no new data field.** The URL lives in `element.link`
(`{ kind: 'url' }`) exactly as a link card's does, so double-clicking opens the
existing `LinkPickerDialog` and `applyElementLink` commits it — no second URL
editor, no new dialog.

The picker opens **restricted**, though. A link card can legitimately point at
a tab or another diagram; a video cannot, because its link is not a
destination, it is the content — a video pointed at a tab has nothing to play.
So `LinkPickerDialog` gained a `urlOnly` config (caller-supplied copy plus a
validator) which hides the mode switcher entirely and validates as you type:
a non-YouTube URL shows "That isn't a YouTube video link" and Save stays
disabled. The validator runs again at commit, so Enter cannot slip past a
message the user has not read. It runs on the **normalised** URL, so a bare
`youtu.be/...` is judged as the `https://youtu.be/...` that would be stored.

The video id is **parsed at render time** from that link by a pure helper
(`youtubeVideoId` in `packages/diagram/src/youtube.ts`), never stored. Link
cards cache their preview in `meta` because unfurling costs a network round
trip; parsing an id costs nothing, so caching it would only create a second
copy of the truth that can drift from the link.

**Aspect-locked to 16:9** on resize, like an icon (spec/41) and for the same
reason: a letterboxed or stretched video frame is never what anyone wants.

**The lock also governs placement.** The Media tiles arm the tap-or-drag draw
gesture like every other palette element (spec/09 "Placement on add"), and the
drag **fits 16:9 inside the drawn box** instead of taking the box verbatim.
Honouring the drag literally would have handed the user the one thing the lock
exists to prevent, on the very gesture that creates the element; fitting keeps
the drag meaningful (it picks the position and the scale) without ever minting
a stretched frame.

`THEME_COLOUR_FIELDS` gives video an **empty** list — like image and sticky, a
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
host — a query string `?v=` on some other site is not a video. Anything the
parser rejects renders the "not a YouTube link" state rather than an id-shaped
guess.

## Nothing loads until you ask

Two deliberate steps, in this order:

1. **Poster only.** The card shows `i.ytimg.com/vi/<id>/hqdefault.jpg` with a
   play button over it. That is one image request to a cookieless static host.
2. **The iframe mounts on play, and not before.** Pressing play swaps the
   poster for `www.youtube-nocookie.com/embed/<id>?autoplay=1`.

Why not just embed the iframe:

- **Cost.** A tab with eight videos would open eight YouTube players on load,
  each pulling a megabyte-plus of player JavaScript, before anyone watched
  anything.
- **The canvas stops working.** An iframe swallows every pointer event inside
  its rectangle, so a video you could not drag, select, or marquee over would
  be a hole in the canvas.
- **Privacy.** `youtube-nocookie.com` sets no cookie until playback starts, so
  simply opening a diagram that contains a video is not a tracked visit. This
  matters more here than usual: the repo is public and self-hostable
  (spec/03), and a self-hoster should not be silently shipping their users to
  Google on page load.

Stopping playback unmounts the iframe, so a paused video is not a live player
sitting in the background.

## The player never takes the pointer by default

The iframe carries `pointer-events: none` **always** — playing, selected, or
not. Anything else breaks dragging, and tying it to selection only moves the
problem one step: clicking a video to drag it selects it, which would make it
interactive, so the drag never starts.

The poster is inert for the same reason. Only two things opt back in: the play
badge, and the two controls that appear top-left on hover once it is playing.

- **Use the player** hands the pointer to the iframe so you can seek, change
  volume, or go fullscreen. Press it again to get dragging back.
- **Stop** unmounts the player and returns to the poster. This is also how you
  pause, since pausing means clicking the player.

Top-**left** because every element's link badge is pinned to the top-right
corner, and a video always has a link — controls there sat underneath it and
could not be clicked.

## States

| Link              | Renders                                                    |
| ----------------- | ---------------------------------------------------------- |
| none              | "Add a YouTube link" prompt, double-click opens the picker |
| not a YouTube URL | the URL plus a "not a YouTube link" hint                   |
| valid             | poster + play button; the iframe once played               |

The normal link badge still applies, so the element also opens on YouTube in a
new tab. Playing inline and opening the source are different intents and both
are worth having.

## Export

- **JSON** round-trips through `validate.ts` like any element.
- **SVG / PNG export and the share thumbnail** cannot contain an iframe or a
  cross-origin image, so a video renders as its card with a play glyph and its
  title. That is the honest static representation.
- **Mermaid / Markdown** export it as a link, which is all those formats can
  hold.

## Telemetry (spec/22)

- `Element·Added·Video` on creation, from the shared
  `elementTelemetryType` mapper so copy / paste / duplicate count too.
- `Element·Used·Video` when playback starts. `Used` is an existing action in
  the closed vocabulary; nothing needed extending.

## Not in scope

Vimeo, Loom, and friends. The only YouTube-specific parts are the parser, the
poster URL and the embed origin, so a second provider is a `provider` field
and three more cases rather than a rewrite. Also out: start-time offsets,
autoplay-on-load (deliberately never), and playlists.
