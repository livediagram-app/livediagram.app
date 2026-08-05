# 121 — More than YouTube

Status: shipped

## What

The video element ([spec/114](114-youtube-video.md)) embeds **YouTube, Vimeo,
Loom, Figma, and Google Docs / Sheets / Slides**.

## Why now

spec/114 said the parser, the poster URL and the embed origin were the only
YouTube-specific parts, and that a second provider would be "a `provider` field
and three more cases rather than a rewrite". This is that, and it needed no
`provider` field at all — the provider is derived from the link, like the video
id already was.

Miro and Excalidraw both embed live third-party content. It is also the
cheapest of the four element gaps, because the hard part (an iframe that
doesn't eat the canvas) was already solved.

## `embedTargetFor`

One function, `(url) => { provider, embedUrl, posterUrl?, label } | null`.

| Provider | Recognised | Embed as |
| -------- | -------------------------------------------------------- | -------------------------------------- | --------------------- |
| YouTube | the five shapes spec/114 lists | `youtube-nocookie.com`, with a poster |
| Vimeo | `vimeo.com/<digits>` | `player.vimeo.com/video/<id>` |
| Loom | `loom.com/share                                          | embed/<id>` | `loom.com/embed/<id>` |
| Figma | any `figma.com` URL | `figma.com/embed?url=<original>` |
| Google | `docs.google.com/{document,spreadsheets,presentation}/…` | the same URL with `/edit` → `/preview` |

Figma takes the **original URL as a query parameter** rather than a rewritten
path, so anything Figma accepts keeps working without this having to know
Figma's file-URL grammar. Google's `/preview` is its documented read-only embed
form, and the path check keeps a Google **Form** — which is not a document —
from being treated as one.

Host matching is exact after stripping `www.`, so `evil-vimeo.com` and
`loom.com.evil.test` are not providers. Non-http schemes are rejected before
anything else, so a `javascript:` URL whose text contains a provider name
cannot resolve.

## Only YouTube gets a poster

It is the only one of the five that publishes a thumbnail at a predictable URL.
The rest render a **named card with a Load button** instead — the provider's
name, and one deliberate press.

That keeps the rule that actually matters (spec/114): nothing third-party loads
until the user asks. A card that fetched a preview to look nicer would trade
away the whole reason the poster-then-iframe design exists.

## One tile per provider

The palette shows **five tiles, not one generic Embed** — YouTube, Vimeo,
Loom, Figma, Google Docs — collapsed behind a single **Embed** row in the Media
tab that opens in place.

A single generic tile hid which services actually work: somebody wanting to
drop a Figma file had no way to know they could. Five always-visible rows would
have made Media mostly embeds and buried Image and Avatar. A drill-in (the
Icons pattern) costs a whole screen and a breadcrumb to show five rows, so the
group opens in place instead, keeping Image and Avatar visible above it.

The tile writes `embedProvider` onto the element. It is a **creation-time hint
only**: it names the empty state ("Add a Figma link") and the link dialog, and
that is all. The link stays authoritative — paste a Vimeo URL into an embed
made from the Figma tile and it renders Vimeo, because refusing a link that
plainly works would be pedantry.

## The link dialog

The video's restricted picker (spec/114) now validates with `embedTargetFor`
and names the five providers in its hint and its error. Everything else about
it is unchanged: URL mode only, validated as you type, validated again at
commit.

## One group open at a time

The collapsible tile group is now shared state across the palette
(`palette-group-state.tsx`): opening one closes any other.

It became necessary when Behaviour grew two groups (spec/105's session tools
and spec/135's reactions) holding eight tiles between them. With both open the
category ran well past the panel, so the reader was scrolling a list they had
opened precisely to avoid scrolling.

Lifted into a context rather than held per group, for the same reason the
element menu lifted its own accordion state: a group cannot close a sibling it
has no reference to, and threading "which one is open" through every tab body
would put palette state in four components with no other use for it. The state
sits above the tabs, so switching category and coming back finds the group as
you left it. `usePaletteGroup` falls back to local state with no provider, so a
group used outside the palette still opens.
