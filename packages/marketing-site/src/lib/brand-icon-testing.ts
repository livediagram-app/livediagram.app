import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every product's brand icon test, run by its apps/marketing/lib/brand-icon.test.ts. Each frontend ships its own
// app/icon.svg, because Next's icon file convention wants one per app (and help's is served under its basePath),
// and marketing/media/logo/ holds the mark and lockup as files. All are written by `pnpm icons:brand` from the
// Living Prism module in the product's ui package. Nothing at runtime notices one of them drifting; this does.
type Scheme = 'light' | 'dark';

export function describeBrandIcon(f: {
  product: string;
  /** The product's folder, as a file URL ending in a slash. */
  repo: URL;
  /** The editor app's folder name under apps/: `editor`, or `live`. */
  editorApp: string;
  brandMarkSvg: (options: { variant: 'compact' | 'full'; scheme: 'auto' | Scheme }) => string;
  brandLogoSvg: (scheme: Scheme) => string;
}): void {
  // The one help centre's edition of this app (liveworkspace/apps/help), whose build serves its icon under /help.
  const HELP_ICON = `../liveworkspace/apps/help/editions/${f.product}/icon`;
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, f.repo)), 'utf8').trim();
  const REGENERATE = 'stale: run `pnpm icons:brand`';

  describe('brand icon', () => {
    it('ships the compact, scheme-following mark as every app/icon.svg', () => {
      const favicon = f.brandMarkSvg({ variant: 'compact', scheme: 'auto' });
      for (const app of ['marketing', f.editorApp])
        expect(read(`apps/${app}/app/icon.svg`), `${app} ${REGENERATE}`).toBe(favicon);
      expect(read(`${HELP_ICON}.svg`), `help ${REGENERATE}`).toBe(favicon);
    });

    it('ships the full mark and the lockup, light and dark, in marketing/media/logo/', () => {
      for (const scheme of ['light', 'dark'] as const) {
        expect(read(`marketing/media/logo/${f.product}-mark-${scheme}.svg`), REGENERATE).toBe(
          f.brandMarkSvg({ variant: 'full', scheme }),
        );
        expect(read(`marketing/media/logo/${f.product}-logo-${scheme}.svg`), REGENERATE).toBe(
          f.brandLogoSvg(scheme),
        );
      }
    });

    // The app that serves its own icon under a basePath (help) pairs the SVG with a PNG fallback through Next's icon
    // file convention (both app/icon.svg and app/icon.png), the 256px white tile the other three name in BRAND_ICONS
    // (docs/specs/016-platform/nextjs.md "Features used and declined").
    it('gives help the PNG fallback, the same tile marketing serves', () => {
      const tile = readFileSync(
        fileURLToPath(new URL(`apps/marketing/public/${f.product}-icon-256.png`, f.repo)),
      );
      expect(
        readFileSync(fileURLToPath(new URL(`${HELP_ICON}.png`, f.repo))).equals(tile),
        `help ${REGENERATE}`,
      ).toBe(true);
    });

    // The api's emails load the mark from the site (docs/specs/014-identity/transactional-email.md "Branding"), so the
    // copy marketing serves for them must be the transparent 64px PNG the generator renders.
    it('serves the emails the transparent 64px mark', () => {
      const mark = readFileSync(
        fileURLToPath(
          new URL(`marketing/media/icons/${f.product}-icon-transparent-64.png`, f.repo),
        ),
      );
      expect(
        readFileSync(
          fileURLToPath(new URL(`apps/marketing/public/email/${f.product}-mark-64.png`, f.repo)),
        ).equals(mark),
        REGENERATE,
      ).toBe(true);
    });
  });
}
