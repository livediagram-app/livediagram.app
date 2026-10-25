# @liveworkspace/help-site

Every product's help centre (`<product>/apps/help`, served at `/help`), built once. The pages, components, MDX
styles, SEO helpers, styles and catalogue checks live here. Each help app keeps only what is its own: its
articles and illustrations, its catalogue (`@<product>/help-registry`), its card art, its header and footer, its
home-page layout and its page copy.

The art is a per-app slot: `HelpHome` draws the Start here card and every category card with the scene the app
hands over in `art.categoryArt` (its `components/category-art/`), so each help centre draws its own Getting Started
story in its own brand colours. An app picks the Start here steps in its layout: `startHere.steps` is either a count
(the walkthrough's first guides) or a list of `categorySlug/slug` articles.

What every help centre draws alike lives once in `src/art/`:

- `art/primitives` and `art/parts`: the illustration kit (`Scene`, `Shape`, `Arrow`, `Label`, …) and the category
  stage with its motifs (`Stage`, `Window`, `Card`, `Chip`, `Kbd`, `Callout`, `DocThumb`, …).
- `art/scenes/<slug>`: the category scenes whose story is the same in every product. Each takes the product's
  content as props (its name, share host, export formats, commands and keys, its work drawn on a screen), and the
  app's `components/category-art/<slug>.tsx` binds it. Policies takes nothing.
- `art/illustrations/<area>`: in-article figures that are the same in every product that shows them.

A scene or figure that shows one product's own work stays in that app.

Specs: `docs/specs/018-help/help-app.md` and `help-pages.md` in each product.

## Binding a help app

A help app binds the package twice, once on each side of the server/client line.

- **Server**, in `lib/help-site.tsx`: `createHelpSite({ siteName, siteUrl, contactFormUrl, catalogue, art,
pageMetadata, cardSubtitle })` returns the `site` every server component and route file takes as a prop. It
  holds the metadata rule, the social cards, the JSON-LD, the article neighbours, the feature hues and glyphs, the
  sitemap and robots.
- **Client**, in `lib/help-client.tsx`: a small `'use client'` provider around `HelpClientProvider` (`./client`).
  It hands the article shell, the search box and the vote their product pieces: `track`, `helpPathTelemetryId`,
  a lazy `loadSearch` (`import('./articles')`, so the registry stays out of every page's JavaScript) and the
  serialisable `facts`. It also installs client error tracking. The root layout mounts it once.

Kept in the app because every article imports them:

- `components/ArticleLayout.tsx` binds `ArticleLayout` to the site.
- `lib/seo.ts` exports `helpMetadata = site.helpMetadata`.
- `mdx-components.tsx` exports `useMDXComponents = createUseMdxComponents(site)`.

## Entry points

There is no barrel, so a page pulls in only what it imports.

| Import             | What                                                                              |
| ------------------ | --------------------------------------------------------------------------------- |
| `./site`           | `createHelpSite`, the `HelpSite` type, the config types                           |
| `./client`         | `HelpClientProvider`, `useHelpClient`, `HelpTrack` (client only)                  |
| `./components/*`   | `HelpHome`, `CategoryPages`, `ContactPage`, `FeatureCategoryIndex`, `Redirect`, … |
| `./lib/*`          | `home` (the home-page layout type), `heading-id`, `feature-tile`, …               |
| `./mdx-components` | `createUseMdxComponents` and the article components                               |
| `./next-config`    | `withHelpSite(config)`: basePath `/help`, trailing slashes, MDX with GFM          |
| `./help.css`       | the help centre's styles and the dark retargeting for its SVG art                 |
| `./testing`        | `describeHelpSite(site, { home, cardSubtitleMax, appDir })`: the catalogue suite  |

## Styles

An app's `app/globals.css` imports Tailwind, its theme and its hero band. It scans this package with
`@source '../../../../packages/help-site/src'`, then imports `@liveworkspace/help-site/help.css`. It sets
`--help-print-link` and `--help-print-section`, the fixed colours a printed article uses. Every other tint is
mixed from `--color-brand-500`.

## Tests

The package tests its own code once (`pnpm --filter @liveworkspace/help-site test`), against a small fixture
catalogue (`src/test/fixture.tsx`). Each app's `lib/help-site.test.ts` runs `describeHelpSite` over its real
catalogue: the counts, groups, home sections, neighbours, sub-article parents, social cards, category art and
support-card icons. Each app keeps the checks that are about its own content: article links, descriptions,
keywords, anchors, canonical paths and feature icons.
