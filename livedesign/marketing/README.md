# Marketing assets

Text and media assets for promoting livedesign: directory listings, launch
posts, social copy, screenshots (none yet), and logos. This folder is for outbound
material only. The product source of truth stays in [`docs/specs/`](../docs/specs/), and
developer docs stay in [`docs/`](../docs/).

Every claim here must map to a shipped feature. If a feature changes, fix the
copy in the same change, the same way [Marketing site](../docs/specs/019-marketing/marketing-site.md)
governs the landing page. When in doubt about what is true today, read
[Build phase](../docs/specs/005-project-roadmap/prototype-scope.md).

## Layout

```
marketing/
  README.md              this file
  copy/
    taglines.md          short one-liners by character budget
    descriptions.md      blurbs by word / character budget
    tags.md              one-word tags / keywords by platform
    facts.md             the canonical fact sheet copy is built from
  media/                 logos, screenshots, social cards (see media/README.md)
```

## House style

- **Voice**: plain, concrete, a little understated. Describe what the product
  does, not how amazing it is.
- **No em dashes.** Use commas, colons, or parentheses.
- **The hook is "no sign-in wall"**: open a link, design together, show it.
  Lead with it.
- **Say what it makes**: logos, wireframes and photos (the site pitch,
  `SITE_PITCH` in `packages/ui/src/site.ts`). It is not a diagram, whiteboard or
  slide tool; never describe it as one.
- **Don't overclaim.** Only what the fact sheet lists as shipped.
- **Free means free.** MIT-licensed, no paid tier, no plan for
  one. Say so where the format allows.
- **Brand color** is rose, `#f43f5e` ("livedesign rose"); text and fills in it use `#be123c`. See
  [Theme](../docs/specs/004-interface-design/color-scheme.md).
