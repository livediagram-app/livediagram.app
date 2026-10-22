# Marketing assets

Text and media assets for promoting liveplanner: directory listings, launch
posts, social copy, screenshots, and logos. This folder is for outbound
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

- **Voice**: plain, concrete, calm and warm. Describe what the product does,
  not how amazing it is.
- **British English**, as the rest of the copy uses: organise, colour, licence
  (the noun).
- **No em dashes.** Use commas, colons, or parentheses.
- **The hook is "plan it together, no sign-up to start"**: open a link, put the
  work on a board, share it. Lead with it.
- **Say "project", never "document".** A project is what a person makes and
  shares; inside it are Board, Sheet, Dashboard and Form tabs.
- **Don't overclaim.** Realtime editing is last-writer-wins, not CRDT (see
  "Not yet shipped" in the fact sheet). Never imply otherwise.
- **Free means free.** No paid tier, no plan for one, no ads and no
  third-party trackers. Say so where the format allows. The source is not
  public: never suggest anyone can read it or run their own copy.
- **Brand colour** is violet, `#8B5CF6` ("liveplanner violet"). See
  [Theme](../docs/specs/004-interface-design/color-scheme.md).
