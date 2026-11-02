import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The Explorer's stylesheet comes after the site's and shares its utilities layer, so a light class it emits again
// beats a `dark:` one only the site's sheet has (explorer.css explains). Every shared package whose `dark:` classes
// draw on the Explorer page is scanned here too: the Settings panel's, and the header's app logo from the brand
// package (whose "live" stayed brand-700 on the dark header).
const css = readFileSync(new URL('./explorer.css', import.meta.url), 'utf8');

describe('explorer.css sources', () => {
  it.each(['packages/settings-ui/src', 'packages/brand/src'])('scans %s', (dir) => {
    expect(css).toContain(`@source '../../../../../${dir}';`);
  });
});
