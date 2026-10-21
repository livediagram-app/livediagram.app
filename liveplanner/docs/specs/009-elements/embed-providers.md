# More than YouTube

## What

The video element ([YouTube video element](youtube-video.md)) embeds **YouTube, Vimeo,
Loom, Figma, and Google Docs / Sheets / Slides**. Any other `http(s)` address frames as a
website ([The Website embed](website-embed.md)).

## Why

The parser, the poster URL and the embed origin are the only provider-specific parts of
[YouTube video element](youtube-video.md), so each provider is one more case in them. There
is no `provider` field: the provider is derived from the link, like the video id.

Miro and Excalidraw both embed live third-party content. The hard part, an iframe that
does not eat the canvas, is shared with the YouTube element.

## `embedTargetFor`

One function, `(url) => { provider, embedUrl, posterUrl?, label } | null`.

| Provider | Recognised                                                      | Embed as                               |
| -------- | --------------------------------------------------------------- | -------------------------------------- |
| YouTube  | the five shapes [YouTube video element](youtube-video.md) lists | `youtube-nocookie.com`, with a poster  |
| Vimeo    | `vimeo.com/<digits>`                                            | `player.vimeo.com/video/<id>`          |
| Loom     | `loom.com/share/<id>` or `loom.com/embed/<id>`                  | `loom.com/embed/<id>`                  |
| Figma    | any `figma.com` URL                                             | `figma.com/embed?url=<original>`       |
| Google   | `docs.google.com/{document,spreadsheets,presentation}/…`        | the same URL with `/edit` → `/preview` |

Figma takes the **original URL as a query parameter** rather than a rewritten
path, so anything Figma accepts keeps working without this having to know
Figma's file-URL grammar. Google's `/preview` is its documented read-only embed
form, and the path check keeps a Google **Form**, which is not a document,
from being treated as one.

Host matching is exact after stripping `www.`, so `evil-vimeo.com` and
`loom.com.evil.test` are not providers. Non-http schemes are rejected before
anything else, so a `javascript:` URL whose text contains a provider name
cannot resolve.

## Only YouTube gets a poster

It is the only one of the five that publishes a thumbnail at a predictable URL.
The rest render a **named card with a Load button** instead: the provider's
name, and one deliberate press.

That keeps the rule that actually matters ([YouTube video element](youtube-video.md)): nothing third-party loads
until the user asks. A card that fetched a preview to look nicer would trade
away the whole reason the poster-then-iframe design exists.

## One tile per provider

The palette shows **six tiles, not one generic Embed**: YouTube, Vimeo,
Loom, Figma, Google Docs and Website, collapsed behind a single **Embed** row in the Media
tab that opens in place.

A single generic tile hides which services actually work: somebody wanting to
drop a Figma file has no way to know they can. Always-visible rows would
make Media mostly embeds and bury Image and Avatar. A drill-in (the
Icons pattern) costs a whole screen and a breadcrumb to show a handful of rows, so the
group opens in place instead, keeping Image and Avatar visible above it.

The tile writes `embedProvider` onto the element. It is a **creation-time hint
only**: it names the empty state ("Add a Figma link") and the link dialog, and
that is all. The link stays authoritative: paste a Vimeo URL into an embed
made from the Figma tile and it renders Vimeo, because refusing a link that
plainly works would be pedantry.

## The link dialog

The video's restricted picker ([YouTube video element](youtube-video.md)) validates with `embedTargetFor`
and names the five providers in its hint and its error. It keeps URL mode only, validated
as you type, validated again at commit.

## One group open at a time

The collapsible tile group is shared state across the palette
(`palette-group-state.tsx`): opening one closes any other.

Behaviour holds two groups ([Session button](../012-collaboration/session-button.md)'s session tools
and [The Reaction Pad](reaction-pad.md)'s reactions) with eight tiles between them. With both open the
category would run well past the panel, so the reader would scroll a list they
opened precisely to avoid scrolling.

The state lives in a context rather than per group, for the same reason the
element menu holds its accordion state in one place: a group cannot close a sibling it
has no reference to, and threading "which one is open" through every tab body
would put palette state in four components with no other use for it. The state
sits above the tabs, so switching category and coming back finds the group as
you left it. `usePaletteGroup` falls back to local state with no provider, so a
group used outside the palette still opens.
