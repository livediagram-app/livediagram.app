# Marketing assets

Text and media assets for promoting livedocuments: directory listings, launch
posts, social copy, screenshots, and logos. This folder is for outbound
material only. The product source of truth stays in [`docs/specs/`](../docs/specs/), and
developer docs stay in [`docs/`](../docs/).

Every claim here must map to a shipped feature. If a feature changes, fix the
copy in the same change, the same way [Marketing site](../docs/specs/019-marketing/marketing-site.md)
governs the landing page. When in doubt about what is true today, read
the [marketing FAQ](../apps/marketing/lib/faq-content.tsx) and the help centre.

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
- **The hook is "documents made of pages, made together"**: write an article,
  present a deck, lay out an infographic, with your team, live. Lead with it.
- **Don't overclaim.** Check "Not yet shipped" in the fact sheet: no CRDT
  editing, and no diagrams, whiteboards, boards, sheets, forms, workshops or
  in-editor AI assistant. Never imply they exist.
- **Free means free.** MIT-licensed, self-hostable, no paid tier, no plan for
  one. Say so where the format allows.
- **Brand color** is amber, `#F59E0B` ("livedocuments amber"); text and fills in it use `#A34A0C`. See
  [Theme](../docs/specs/004-interface-design/color-scheme.md).
