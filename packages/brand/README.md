# @liveworkspace/brand

Every app's logo, drawn once: the Living Prism (a glass cube) and the `live` + name wordmark, in each app's own
colours. Each product's `brand-mark.md` spec (`<product>/docs/specs/004-interface-design/brand-mark.md`) describes
the mark; this package is its one source.

- `BRAND_APPS`: per app, its word, prism palettes (light and dark), lockup colours and wordmark classes.
- `Brand`, `BrandMark`: the logo and the prism, with the hover turn and gleam. Each product's `ui` binds them to
  its app (`packages/ui/src/Brand.tsx`), so its callers don't pass `app`.
- `BrandGlyph`: the prism at rest in `currentColor`, with no state or gradients, for marks on long lists (the
  One Explorer's rows under All Apps).
- `@liveworkspace/brand/svg`: the same drawing as strings, with no React (`brandMarkSvg`, `brandLogoSvg`,
  `prismPalette`), for favicons, the logo files, the Apple icon and the social card.
- `WorkspaceWordmark`: liveworkspace's logo, the prism in the platform's slate beside its name, for liveworkspace.app's header and every app's footer.
- `@liveworkspace/brand/colour`: the colour helpers the palettes are checked with (`hexToRgb`, `rgbToHex`,
  `contrastRatio`).

Its classes are Tailwind utilities: an app that renders it adds `@source '…/packages/brand/src';` to its stylesheet.

## Tests

`corepack pnpm --filter @liveworkspace/brand test`
