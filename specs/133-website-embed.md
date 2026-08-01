# 133 — The Website embed

An **Embed** provider that frames any `http(s)` address on the canvas, next to
the named ones (YouTube, Vimeo, Loom, Figma, Google Docs — see
[spec/121](121-embed-providers.md)).

Type `https://www.bbc.co.uk`, press **Load embed**, and the page renders inside
the element.

## Resolution order

`embedTargetFor` gains a final catch-all returning `provider: 'website'` with
the URL passed through untouched. Three things about where it sits:

- **Last.** Every named provider still wins on its own hosts, so a YouTube link
  is still a YouTube player and not a framed watch page.
- **Not reached by a malformed link for a provider we DO know.** `vimeo.com/nonsense`
  still returns `null`, because "that isn't a Vimeo video" is a more useful
  answer than silently framing a 404 page. Only hosts we have no opinion about
  reach the catch-all.
- **`http(s)` only**, unchanged. A `javascript:` or `data:` URL is refused
  before the catch-all can see it, which is the property that matters most now
  that the catch-all exists — it must not become a way in.

A lookalike host (`evil-vimeo.com`) resolves as an anonymous **website**, never
as the provider it imitates. It is still framed, because the user typed it and
framing an address is the feature; it just never gets to wear Vimeo's name.

## The label is the host

`bbc.co.uk`, not the word "Website". A card that names what it holds is worth
having; a row of three cards all reading "Website" is not.

## Sandbox

The website iframe carries
`sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"`.
The named providers carry no sandbox, because it breaks several of them and
those hosts were chosen deliberately.

The permission that matters is the one **absent**: `allow-top-navigation`.
Without it a framed page cannot navigate the editor tab out from under the
user, which is the one thing an "embed any URL" feature must not allow.
Scripts and forms stay on, since a page without them is not a page.
`allow-same-origin` is safe here: it means same-origin with the framed site,
which is never us.

## Nothing loads until asked

Unchanged from spec/121 and load-bearing: the iframe is not mounted until the
user presses **Load embed**. Opening a diagram containing five website embeds
must not fetch five third-party pages, and a self-hoster (spec/03) should not
be silently shipping their users anywhere on page load.

## Honest about framing

Plenty of sites send `X-Frame-Options: DENY` and will come up blank; there is
no cross-origin way to detect it. So the palette tile, the link dialog hint and
the provider hint all say so up front rather than leaving a blank rectangle to
be interpreted.
