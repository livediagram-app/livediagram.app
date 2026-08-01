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

Plenty of sites send `X-Frame-Options: DENY` or a CSP `frame-ancestors` and
will come up blank. **This is not detectable from the page**, and the code says
so at length rather than pretending otherwise.

Measured in Chrome, bbc.co.uk (which sends both headers) against example.com
(which sends neither):

| signal                   | example.com | bbc.co.uk |
| ------------------------ | ----------- | --------- |
| `load` event             | fires       | fires     |
| `error` event            | no          | no        |
| `contentWindow.location` | throws      | throws    |
| `contentDocument`        | null        | null      |
| `contentWindow.origin`   | throws      | throws    |
| `contentWindow.length`   | 0           | 0         |
| resource-timing entry    | present     | present   |

Chrome serves its refusal page as a cross-origin document, so the familiar
"read `location.href`, see `about:blank`" trick reports success for both. A
first cut used exactly that with a timeout behind it, and the timeout is what
actually fired: every website embed grew a "won't load" notice eight seconds
after loading perfectly.

So the product does two things instead of one clever thing:

- **What is provable is reported.** `useFrameBlocked` claims only that the
  frame produced no `load` event at all inside 8s, which catches a hung or
  unreachable site. The notice it shows is hedged accordingly ("isn't loading",
  naming both possible causes) rather than asserting a refusal it cannot see.
- **What is not provable gets an escape hatch.** A website embed always carries
  an **Open in a new tab** control beside its player controls. That covers the
  refusal case without a diagnosis, and it is the action the user wants anyway.

The palette tile, the link dialog hint and the provider hint also warn up front
that some sites refuse framing, so a blank rectangle is never the first the
user hears of it.
