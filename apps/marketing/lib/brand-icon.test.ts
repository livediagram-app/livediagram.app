import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { brandLogoSvg, brandMarkSvg } from '@livediagram/ui';

// Each frontend ships its own app/icon.svg, because Next's icon file
// convention wants one per app (and help's is served under its basePath), and
// marketing/media/logo/ holds the mark and lockup as files. All are written by
// `pnpm icons:brand` from the Living Prism module in @livediagram/ui. Nothing
// at runtime notices one of them drifting; this does.

const APPS = ['marketing', 'live', 'help', 'telemetry', 'community'] as const;
const REPO = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, REPO)), 'utf8').trim();
const REGENERATE = 'stale: run `pnpm icons:brand`';

describe('brand icon', () => {
  it('ships the compact, scheme-following mark as every app/icon.svg', () => {
    const favicon = brandMarkSvg({ variant: 'compact', scheme: 'auto' });
    for (const app of APPS)
      expect(read(`apps/${app}/app/icon.svg`), `${app} ${REGENERATE}`).toBe(favicon);
  });

  it('ships the full mark and the lockup, light and dark, in marketing/media/logo/', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(read(`marketing/media/logo/livediagram-mark-${scheme}.svg`), REGENERATE).toBe(
        brandMarkSvg({ variant: 'full', scheme }),
      );
      expect(read(`marketing/media/logo/livediagram-logo-${scheme}.svg`), REGENERATE).toBe(
        brandLogoSvg(scheme),
      );
    }
  });

  // The apps that serve their own icon under a basePath (help, community) pair the SVG with a PNG fallback through
  // Next's icon file convention (both app/icon.svg and app/icon.png), the 256px white tile the other three name in
  // BRAND_ICONS (docs/specs/016-platform/nextjs.md "Features used and declined").
  it('gives help and community the PNG fallback, the same tile marketing serves', () => {
    const tile = readFileSync(
      fileURLToPath(new URL('apps/marketing/public/livediagram-icon-256.png', REPO)),
    );
    for (const app of ['help', 'community'])
      expect(
        readFileSync(fileURLToPath(new URL(`apps/${app}/app/icon.png`, REPO))).equals(tile),
        `${app} ${REGENERATE}`,
      ).toBe(true);
  });

  // The api's emails load the mark from the site (docs/specs/014-identity/transactional-email.md "Branding"), so the
  // copy marketing serves for them must be the transparent 64px PNG the generator renders.
  it('serves the emails the transparent 64px mark', () => {
    const mark = readFileSync(
      fileURLToPath(new URL('marketing/media/icons/livediagram-icon-transparent-64.png', REPO)),
    );
    expect(
      readFileSync(
        fileURLToPath(new URL('apps/marketing/public/email/livediagram-mark-64.png', REPO)),
      ).equals(mark),
      REGENERATE,
    ).toBe(true);
  });
});
