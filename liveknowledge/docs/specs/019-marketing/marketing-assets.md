# Marketing assets

The `marketing/` folder (repo root) holds outbound promotional material: copy
for directory listings, app stores, launch posts, and social, plus media
(logos, screenshots, social cards). It is distinct from three neighbours:

- [`docs/specs/`](../README.md) is the product source of truth (what to build).
- [`docs/`](../..) is developer- and user-facing documentation (how to run,
  host, contribute).
- `apps/marketing` is the live landing **site** at `/` (see
  [16-marketing-site](marketing-site.md)); `marketing/` is the **off-site**
  copy and assets used to list and promote the product elsewhere.

## Golden rule: claims map to shipped features

Same rule as the landing page ([Marketing site](marketing-site.md)): every claim in
`marketing/` is something a visitor can do today. What the fork brought and
liveknowledge cut (slides, infographics, page layouts, presenting, PowerPoint)
and what v1 leaves for later (databases, page-level permissions, semantic
search, public sites, Google Docs import, a native mobile app, reminder emails)
must not appear, even softened; `copy/facts.md` lists both under "Out of scope".
When the product gains or loses a feature, update the affected copy in the same
change.

## Layout

```
marketing/
  README.md              what the folder is for + house style
  copy/
    facts.md             canonical fact sheet; all copy derives from it
    taglines.md          one-liners bucketed by character budget
    descriptions.md      blurbs bucketed by word / character budget
    tags.md              one-word tags / keywords bucketed by platform
  media/                 see media/README.md
    icons/               the brand mark as PNGs
    logo/                the mark and lockup as SVG
```

`copy/facts.md` is the single source the taglines and descriptions are built
from. Change a fact there first, then propagate. The other copy files annotate
each variant with its length budget so a listing field's limit maps to a ready
variant (for example a 35-char tagline slot uses a `<= 30` line; a 500-word
listing body uses the ~500-word description).

## Tone & brand

Inherits [Marketing site](marketing-site.md) and [Purpose](../001-project-vision/purpose.md): plain,
concrete, understated. Lead with the pitch line, "A team knowledgebase, for
people and for AI.", and with what makes it different: trust is part of the
page, agents are first-class readers, Ask does not guess. Say who pays for Ask
(the team, on its own Claude API key) wherever Ask is sold. Say "free,
MIT-licensed, free to start" where the format allows
([Open source](../002-project-scope/open-source-and-business-model.md)). Product name
**liveknowledge** (lowercase); **knowledgebase** is one word, and the product is
never called a wiki. Brand colour lime: accent `#4d7c0f`, tints `#f7fee7`
`#ecfccb` `#d9f99d`, dark accent `#a3e635`
([Colour scheme](../004-interface-design/color-scheme.md)). No em dashes in the copy.

## Media

Binary assets live under `marketing/media/` (see its README for the layout and
brand guidance). Prefer SVG for logos and optimised PNG or WebP for
screenshots. A screenshot shows a knowledgebase made for the shot (a page tree,
a verified page, an answer with its sources), never a real team's pages. The
logo lockups and icons are generated from the brand module in lime
(`pnpm icons:brand`); a test fails if a committed copy drifts
(`apps/marketing/lib/brand-icon.test.ts`). Keep heavy binaries out of git where
practical. Screenshots go in `media/desktop/` and `media/mobile/`, captioned.
