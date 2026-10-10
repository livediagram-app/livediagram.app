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
});
