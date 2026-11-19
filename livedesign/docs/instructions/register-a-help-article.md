# Register a help article

livedesign's help is the `livedesign` scope of liveworkspace's one help centre (`liveworkspace/apps/help`,
[One help centre](../../../liveworkspace/docs/specs/017-help/help-centre.md) and its
[blueprint](../../../liveworkspace/docs/specs/017-help/blueprints/help-centre.md)). Its catalogue,
`packages/help-registry/src/catalogue/` at the monorepo root, is the **single source for the help search, the
category and browse listings, and the editor's search panel Help group** (`apps/live/lib/help-search.ts` reads
livedesign's slice through [`@livedesign/help-registry`](../../packages/help-registry/src/index.ts)). An article's MDX page
renders from the filesystem, but it is **invisible to search and browse unless the catalogue has it**, and it shows
in an app's help only when its entry names that app.

An article that isn't registered is a bug, the same way an out-of-date spec is. Follow these steps whenever you
add, remove or rename a help article, all **in the same change**.

## Steps

1. Write (or move, or delete) `liveworkspace/apps/help/app/<categorySlug>/<slug>/page.mdx`. One file per path for
   every app: if the path already exists for another app, extend that article rather than adding a second one.
2. Add (or update, or remove) its entry: `slug`, `title`, `description`, `keywords`, `category`, `categorySlug`
   (the full nested path, e.g. `canvas/the-canvas`), `parentSlug` for a sub-article, and `apps`, the app ids it
   applies to in registry order (see `APP_ORDER` in `packages/help-registry/src/apps.ts`). An
   article for livedesign alone goes in `packages/help-registry/src/catalogue/livedesign.ts` with `apps: ['livedesign']`; one that
   several apps share goes in a batch under `packages/help-registry/src/catalogue/shared/`.
3. Check `categorySlug`/`slug` match the `page.mdx` path, so the search result link resolves.
4. Write the `description` as the **short search-card summary**. It is intentionally separate from the MDX
   `helpMetadata` description (the longer SEO/OG meta): write a concise one, don't just copy the meta.
5. Write `keywords` (**required**): space-separated, lowercase search synonyms, the words a user would type when
   they don't know the title ("transparency" for opacity, "hotkey" for keyboard shortcuts), plus adjacent spellings
   ("color" beside "colour"). The help search and the editor's search panel match on them; a test fails if they're
   missing.
6. **Write shared copy once.** In an article several apps share, name the work with `<Noun />` (`<Noun plural />`,
   `<Noun capital />`; "design" in livedesign's help) and the product with `<AppName />`, and put what is true for
   one app only inside `<AppNote app="livedesign">...</AppNote>` (several apps: `app="livedesign,livediagram"`). A note for an app
   the article does not apply to fails the build. A figure for some apps only takes `<Figure app="livedesign" ... />`.
7. **Per-app wording.** Where the shared title or description reads wrong in livedesign's help, give the entry
   `byApp: { livedesign: { title, description } }` (an entry may also set `group` and `category`; a category takes
   `byApp` titles and descriptions too). livedesign's help, its search and its editor's search panel then show that
   wording; All Apps and the other apps keep the shared one.
8. **Reading order.** Add the path to livedesign's order, `packages/help-registry/src/catalogue/order/livedesign.ts`, where it
   should sit among its siblings: the previous and next links and the category pages follow it.
9. If the category lists `groups`, set the article's `group` to one of them; left out, the browse page shows the
   article under an empty heading and a test fails. A category's `articleCount` is worked out from the catalogue.
10. **Moved, merged or retired?** Add the old path to `HELP_REDIRECTS` in
    `packages/help-registry/src/catalogue/redirects.ts` (with `apps` when it holds on some apps' addresses only),
    so links already shared keep landing.
11. **Draw the card.** For an article in a **feature** category, add an entry to BOTH `FEATURE_ICONS`
    (`liveworkspace/apps/help/editions/livedesign/lib/featureIcons.tsx`) and `FEATURE_ENTITY_HEX`
    (`liveworkspace/apps/help/editions/livedesign/lib/featureColours.ts`); for a **support** category, add one to
    `SUPPORT_ARTICLE_ICONS` (`liveworkspace/apps/help/editions/livedesign/lib/articleIcons.tsx`), which needs no hue.
    Draw what the card is _about_, and check it doesn't land on a glyph either set already uses: a card with no
    entry silently falls back to a shared glyph.
12. Run the help tests (`corepack pnpm --filter @liveworkspace/help test`): the framework's suites and each
    edition's (`liveworkspace/apps/help/editions/livedesign/tests/`, run as livedesign's scope) keep every card drawn and
    every link, note and path honest; `corepack pnpm --filter @liveworkspace/help-registry test` checks the
    catalogue (every article names an app, each path once, redirects land).
