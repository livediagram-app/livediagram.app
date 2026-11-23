# Marketing assets

Text and media assets for promoting liveknowledge: directory listings, launch
posts, social copy, screenshots, and logos. This folder is for outbound
material only. The product source of truth stays in [`docs/specs/`](../docs/specs/), and
developer docs stay in [`docs/`](../docs/).

Every claim here must map to a shipped feature. If a feature changes, fix the
copy in the same change, the same way [Marketing site](../docs/specs/019-marketing/marketing-site.md)
governs the landing page. When in doubt about what is true, read
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
- **The hook is "a team knowledgebase, for people and for AI"**: pages your
  team and its agents both trust, because each has an owner and a verified
  date. Lead with it.
- **Knowledgebase is one word.** Never "wiki" for the product, never
  "knowledge base". "Wiki" only names the category another tool is in.
- **Don't overclaim.** Check "Out of scope" in the fact sheet: no slides,
  infographics or page layouts (those are livedocuments'), no databases,
  page-level permissions, semantic search, public sites or built-in model.
  Never imply they exist.
- **Free to start.** MIT-licensed, no card, no trial clock. Say so where
  the format allows. Don't claim there is no paid tier (Pro raises a few
  limits), and don't lead with Pro.
- **Brand colour** is lime: accent `#4d7c0f`, tints `#f7fee7` `#ecfccb` `#d9f99d`, dark accent
  `#a3e635`. See [Theme](../docs/specs/004-interface-design/color-scheme.md).
