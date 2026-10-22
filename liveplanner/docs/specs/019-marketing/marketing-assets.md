# Marketing assets

The `marketing/` folder (repo root) holds outbound promotional material: copy
for directory listings, app stores, launch posts, and social, plus media
(logos, screenshots, social cards). It is distinct from three neighbours:

- [`docs/specs/`](../README.md) is the product source of truth (what to build).
- [`docs/`](../..) is developer- and user-facing documentation (how to run and
  change the code).
- `apps/marketing` is the live landing **site** at `/` (see
  [16-marketing-site](marketing-site.md)); `marketing/` is the **off-site**
  copy and assets used to list and promote the product elsewhere.

## Golden rule: claims map to shipped features

Same rule as the landing page ([16](marketing-site.md)): every claim in
`marketing/` must correspond to something a visitor can do today. The unshipped
items in [02-prototype-scope](../005-project-roadmap/prototype-scope.md) (team workspaces,
transactional email, CRDT / conflict-free editing) must not appear, even
softened. When the editor gains or loses a feature, update the affected copy in
the same change. Counts (currently 28 Plan templates, 24 themes, ten core shapes)
must match their source of truth, as pinned by the editor app's tests.

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
    desktop/             desktop product screenshots, captioned
    mobile/              mobile product screenshots, captioned
```

`copy/facts.md` is the single source the taglines and descriptions are built
from. Change a fact there first, then propagate. The other copy files annotate
each variant with its length budget so a listing field's limit maps to a ready
variant (for example a 35-char tagline slot uses a `<= 30` line; a 500-word
listing body uses the ~500-word description).

## Tone & brand

Inherits [16](marketing-site.md) and [00-purpose](../001-project-vision/purpose.md): plain,
calm, clear, warm and concise; free planning in real time for teams:
boards, sheets, dashboards and forms in one project. Lead with the hook: a
project works without signing in (open a link, plan, share). Say "project",
never "document", in anything a person reads. Be honest about trade-offs (realtime is last-write-wins,
not CRDT). Say "free, no trackers, no ads, no paid tier" where the
format allows. Never call liveplanner open source, MIT-licensed or self-hostable: it is proprietary ([03](../002-project-scope/business-model-and-licence.md)). Product name
**liveplanner** (lowercase); brand colour violet `#8B5CF6`
([01-color-scheme](../004-interface-design/color-scheme.md)). No em dashes in the copy.

## Media

Binary assets live under `marketing/media/` (see its README for the suggested
sub-layout and brand guidance). Prefer SVG for logos and optimised PNG / WebP
for screenshots; screenshots should show a real board, sheet, dashboard or form
with visible multiplayer cursors, since "no sign-in, real-time" is the pitch. Keep heavy
binaries out of git where practical.
