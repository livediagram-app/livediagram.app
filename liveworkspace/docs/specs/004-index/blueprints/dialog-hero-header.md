# The dialog hero header: blueprint

Derived from [dialog-hero-header.md](../dialog-hero-header.md). The spec decides; this file only adds engineering
precision, read from the code. Paths are relative to the repository root.

| File                                                                                       | Role                                                                                                                                          |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/dialog/hero/HeroDialogHeader.tsx`                                         | `HeroDialogHeader` (the frame), `HeroBand` and `HeroTitleMark` (memoised parts)                                                               |
| `packages/ui/src/dialog/hero/hero-tokens.ts`                                               | `HERO_TOKENS` (the recipes), `HERO_TOKEN_STYLE`, `heroVar`, `resolveHeroTokens`, `HERO_INK_CONTRAST`, `HERO_GROUNDS`                          |
| `packages/ui/src/dialog/hero/hero-art.ts`                                                  | `HeroArt`, `heroTexture`, `HERO_PLACE`, `HERO_MOTION`, `HERO_SVG`, the textures' measures                                                     |
| `packages/ui/src/dialog/hero/index.ts`                                                     | the `@liveworkspace/ui/dialog-hero` subpath                                                                                                   |
| `packages/ui/src/dialog/hero/art/<dialog>.tsx`                                             | shared art, `@liveworkspace/ui/dialog-hero-art/<dialog>` (a wildcard export: no package.json edit)                                            |
| `packages/ui/src/dialog/hero/art/share.tsx`                                                | `shareHeroArt`                                                                                                                                |
| `packages/ui/src/dialog/hero/art/export.tsx`                                               | `exportHeroArt` (every product's `ExportTabDialog`)                                                                                           |
| `packages/ui/src/dialog/hero/art/import.tsx`                                               | `importHeroArt` (every product's `ImportTabDialog`; livediagram's `DrawioImportDialog`, `ExcalidrawImportDialog`, `MsWhiteboardImportDialog`) |
| `packages/ui/src/dialog/hero/art/history.tsx`                                              | `historyHeroArt` (`packages/explorer/src/library/HistoryDialog.tsx`)                                                                          |
| `packages/ui/src/dialog/hero/art/community-publish.tsx`                                    | `communityPublishHeroArt` (`packages/community-ui/src/share/CommunityPublishDialog.tsx`)                                                      |
| `liveplanner/apps/editor/components/automations/AutomationsHeroArt.tsx`                    | `automationsHeroArt` (product art: `<Dialog>HeroArt.tsx` beside its dialog)                                                                   |
| `livedocuments/apps/editor/app/globals.css`, `liveworkspace/apps/site/app/app-colours.css` | the heading face's custom properties                                                                                                          |
| `packages/oxlint-config/raw-svg.ts`                                                        | `**/dialog/hero/**` and `**/*HeroArt.tsx` on the icon-art allowlist                                                                           |
| `packages/ui/src/dialog/hero/art/webhooks.tsx`                                             | `webhooksHeroArt` (`DocumentWebhooksDialog`)                                                                                                  |
| `packages/ui/src/dialog/hero/art/team.tsx`, `team-invite.tsx`                              | `teamHeroArt` (Members, New Team, Edit Team) and `teamInviteHeroArt` (Invite by Link), one drawing                                            |
| `liveplanner/apps/editor/components/plan/configure/BoardConfigureHeroArt.tsx`              | `boardConfigureHeroArt` (Configure Board, through `ClusterPanel`'s `hero`)                                                                    |
| `liveplanner/apps/editor/components/plan/SetupHeroArt.tsx`                                 | `setupBoardHeroArt`, `setupSheetHeroArt` (`SetupDialog`'s `art`)                                                                              |
| `liveplanner/apps/editor/components/forms/ShareFormHeroArt.tsx`                            | `shareFormHeroArt` (Share Form)                                                                                                               |
| `livedesign/apps/live/components/canvas/LayoutGalleryHeroArt.tsx`                          | `layoutGalleryHeroArt` (Choose a Layout's dialog)                                                                                             |
| `packages/ui/src/dialog/hero/art/settings.tsx`                                             | `settingsHeroArt` (every app's Settings, through `SettingsView`), `SETTINGS_GLYPH`, `cogPath`                                                 |
| `packages/ui/src/dialog/hero/art/collaborators.tsx`                                        | `collaboratorsHeroArt` (every app's Collaborators)                                                                                            |
| `packages/ui/src/dialog/hero/art/canvas-theme.tsx`                                         | `canvasThemeHeroArt` (Tab Style: livedesign, livediagram, livedocuments, livehuddle)                                                          |
| `liveworkspace/apps/site/components/settings/SiteSettingsHeroArt.tsx`                      | `siteSettingsHeroArt`, passed to `SettingsPanel` as `heroArt`                                                                                 |

## The frame's API

```tsx
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { shareHeroArt } from '@liveworkspace/ui/dialog-hero-art/share';

const titleId = useId();
<Dialog open onClose={close} titleId={titleId} size="lg">
  <HeroDialogHeader
    art={shareHeroArt} // HeroArt, a module constant
    titleId={titleId} // the <h2>'s id
    title="Share This Plan"
    subtitle={<ShareStatus />} // optional: one line; sr-only on a phone
    actions={<>…</>} // optional: before the close
    onClose={close} // optional: renders DialogCloseButton last
    underHandle // optional: a phoneSheet dialog
    className="[--hero-centre-end:15rem]" // optional
  />
  …
</Dialog>;
```

The root is a `<div data-dialog-hero>`, not a `<header>`: outside sectioning content a `<header>` is a banner
landmark, and a dialog must not give the page a second banner (`HeroDialogHeader.test.tsx` holds it; select the
header by `[data-dialog-hero]`). The header must be the panel's first child (or follow the phone sheet's handle): its top corners inherit the
panel's radius. A product app that imports `@liveworkspace/ui/dialog-hero` lists `@liveworkspace/ui` in its own
dependencies (`corepack pnpm --filter <app> add @liveworkspace/ui@workspace:*`), as liveplanner's editor does.

## HeroArt

```ts
type HeroArt = {
  name: string; // kebab-case, the file's name: data-dialog-hero-art
  glyph: ReactNode; // SVG content for a 20 x 20 box, in var(--hero-accent)
  texture?: CSSProperties; // heroTexture('dots' | 'grid' | 'baseline' | 'rings', { fade?, from? })
  pieces: ReactNode; // <svg {...HERO_SVG} className={HERO_PLACE.bottomLeft | bottomRight | centre}>
  centre?: boolean; // true when pieces include a HERO_PLACE.centre piece
};
```

- Colours only as `var(--hero-<token>)` (`fill`, `stroke`, or a Tailwind arbitrary value); never a literal colour.
- Motion only through `HERO_MOTION.ring` or `HERO_MOTION.float`, on one element.
- `HERO_PLACE.centre` is `hidden @4xl:block`, right-anchored at `var(--hero-centre-end, 12.5rem)`; corners are
  `max-sm:hidden` (the phone band is texture alone); any other piece an art adds outside `HERO_PLACE` hides there too.
- `art/art-rules.test.tsx` imports every file in the shared folder and checks: a `HeroArt` export named after the
  file, no literal colour, image, `url(`, `href` or filter, at most one motion (`motion-safe:`, two or three
  iterations), hidden pieces, and a centre piece exactly when `centre`. Product art carries its own test
  (`AutomationsHeroArt.test.tsx`).

## Tokens

`HERO_TOKEN_STYLE` sets every `--hero-*` on the header as `light-dark(<light>, <dark>)`; each side is a brand or
slate stop or `color-mix(in srgb, <stop> <share>, <ground>)`, the ground `white` or `var(--color-slate-900)`. The
header sets `color-scheme: light`, and `dark` under the app's `dark:` variant, so `light-dark()` follows the same
switch as every `dark:` class (a `.light` island included). `--hero-lift` is the sheet handle's 32px
(`SHEET_HANDLE_PX`). `Dialog`'s sheet handle is `relative z-10` so the band can run under it.

`resolveHeroTokens(mode, brand, slate)` computes the same mixes in sRGB channels, for the tests:

- `packages/ui/src/dialog/hero/hero-tokens.test.ts`: every product's ramp (each `<product>/packages/tailwind-config/theme.css`,
  the shared theme for livediagram and liveworkspace.app) and liveworkspace.app's `app-colours.css`, light and dark:
  ink and muted at 4.5:1 on `HERO_GROUNDS` (paper, soft); the accent at 3:1 on the wash.
- `packages/workbench/src/hooks/ui/editor-accent-hero.test.ts`: the same under nine themed-tab accents
  (`editorAccentCss`).

## The title's face

`HeroDialogHeader`'s `<h2>` carries `[font-family:var(--hero-heading-family)]`,
`[font-weight:var(--hero-heading-weight,800)]` and `[letter-spacing:var(--hero-heading-tracking,-0.025em)]`. An unset
`--hero-heading-family` makes the declaration invalid at computed-value time, which for an inherited property means
`inherit`: the page's own face.

## Measures

| What             | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Height from `sm` | `sm:h-[100px]`, `sm:px-6`                                          |
| Phone            | `max-sm:px-4 max-sm:py-3` (56px with one title line)               |
| Mark             | `size-9` / `max-sm:size-8`, `rounded-[11px]`, glyph 20px           |
| Title            | 20px / 18px, `leading-tight`, `sm:truncate`, `max-sm:line-clamp-2` |
| Line             | 13px / 18px, `truncate`, `max-sm:sr-only`                          |
| Centre piece     | from `@4xl` (56rem header); title and line `@4xl:max-w-[26rem]`    |
| Gaps             | 12px between mark, words and actions; 8px between actions          |

Measured in a browser: 100px at 1280, 1024 and 768 wide for Automations and Share (liveplanner, livedocuments), and
for Export, Import, History and Share to Community (livediagram, livedocuments, light and dark), 56px on a 390px
phone; livediagram's Import from Microsoft Whiteboard is 69px there, its title taking the second line the phone
allows. The same for Settings (signed in with the switch, and a guest without it),
Collaborators and Tab Style (livedocuments, livediagram) and liveworkspace.app's Settings, light and dark.

`SettingsView` (`@liveworkspace/settings-ui`) draws the header for every Settings: `settingsHeroArt` unless the host
passes `heroArt` (through `SettingsPanel`), its line the panel's `subtitle` for the side shown, the scope switch and
the kit's close as its actions, and `[--hero-centre-end:17rem]` while the switch shows. Tab Style's own panel (not
`Dialog`) gives its `SheetHandle` `relative z-10` and the header `underHandle`, as `Dialog`'s phone sheet does.

## Size

Measured minified (esbuild, React external): the frame, tokens and helpers are 5.6 KB, 2.4 KB gzipped, beyond the
`DialogCloseButton` and `SheetHandle` every dialog already loads; Share's art 2.1 KB (1.0 KB gzipped), Automations'
2.3 KB (1.0 KB gzipped); the shared art: Export's 2.9 KB (1.0 KB), Import's 2.1 KB (1.0 KB), History's 2.4 KB
(0.9 KB), Share to Community's 1.8 KB (0.9 KB), Webhooks' 2.7 KB (1.0 KB), Team's 2.2 KB (1.0 KB) and Team Invite's
0.4 KB over it (0.3 KB); the product art: Configure Board's 2.0 KB (0.7 KB), Setup's two 4.2 KB (1.4 KB), Share
Form's 2.3 KB (1.0 KB) and Choose a Layout's 2.9 KB (1.2 KB gzipped); Settings' 2.7 KB (1.0 KB), Collaborators' 1.7 KB (0.8 KB), Tab Style's 1.8 KB (0.8 KB) and liveworkspace.app's Settings 2.1 KB (0.9 KB, beside the shared Settings art `SettingsView` imports as its default). Art loads only with its dialog's chunk; the
band paints once.
