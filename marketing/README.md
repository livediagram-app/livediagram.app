# Marketing assets

Text and media assets for promoting livediagram: directory listings, launch
posts, social copy, screenshots, and logos. This folder is for outbound
material only. The product source of truth stays in [`specs/`](../specs/), and
developer docs stay in [`docs/`](../docs/).

Every claim here must map to a shipped feature. If a feature changes, fix the
copy in the same change, the same way [spec/16](../specs/16-marketing-site.md)
governs the landing page. When in doubt about what is true today, read
[docs/what-is-livediagram.md](../docs/what-is-livediagram.md).

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
- **The hook is "no sign-in wall"**: open a link, draw, share. Lead with it.
- **Don't overclaim.** Team workspaces, transactional email, and CRDT editing
  are not shipped yet (see "What's still ahead" in the fact sheet). Never imply
  they are.
- **Free means free.** MIT-licensed, self-hostable, no paid tier, no plan for
  one. Say so where the format allows.
- **Brand color** is sky blue, `#0EA5E9` ("livediagram blue"). See
  [spec/01](../specs/01-color-scheme.md).
