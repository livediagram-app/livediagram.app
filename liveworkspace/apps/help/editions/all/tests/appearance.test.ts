import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLATFORM_APPEARANCE_KEY } from '../lib/appearance-store';

// The All Apps help's Appearance toggle writes liveworkspace.app's own key (editions/all/lib/appearance-store.ts), so a
// pick holds between the site and its help.
describe('All Apps appearance', () => {
  it("uses the key liveworkspace.app's site reads", () => {
    const site = readFileSync(
      new URL('../../../../site/lib/appearance/appearance-keys.ts', import.meta.url),
      'utf8',
    );
    // The site's platform key is livediagram's (it has always read that one).
    expect(site).toContain('PLATFORM_APPEARANCE_KEY = APP_APPEARANCE_KEYS.livediagram;');
    expect(site).toContain(`livediagram: '${PLATFORM_APPEARANCE_KEY}'`);
  });

  it('builds its header from the shared SiteHeader with the rail (no hand-drawn bar)', () => {
    const header = readFileSync(new URL('../components/Header.tsx', import.meta.url), 'utf8');
    expect(header).toContain("from '@liveworkspace/ui/site-header'");
    const parts = readFileSync(new URL('../components/HeaderParts.tsx', import.meta.url), 'utf8');
    expect(parts).toContain('SiteAppearanceToggle');
  });
});
