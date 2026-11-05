import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every landing hero takes the screen-filling height from one stylesheet (css/hero-tall.css; each product's
// docs/specs/019-marketing/marketing-site.md "Hero", liveworkspace/docs/specs/010-site/site.md "The front
// door"), so no app's hero drifts back to its content's height while the others fill the screen.
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

const HEROES = [
  ...['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'].map((p) => ({
    name: p,
    hero: `${p}/apps/marketing/components/Hero.tsx`,
    css: `${p}/apps/marketing/app/globals.css`,
    copy: true,
  })),
  {
    name: 'liveworkspace site',
    hero: 'liveworkspace/apps/site/app/page.tsx',
    css: 'liveworkspace/apps/site/app/globals.css',
    copy: false,
  },
];

const read = (path: string) => readFileSync(join(REPO, path), 'utf8');

describe('the landing heroes fill the first screen', () => {
  it.each(HEROES)('$name loads the shared stylesheet and marks its hero', ({ hero, css, copy }) => {
    expect(read(css)).toContain("@import '@liveworkspace/marketing-site/css/hero-tall.css';");
    const source = read(hero);
    expect(source).toMatch(/<section className="[^"]*\bhero-tall\b/);
    // The products share the extra height out round their copy; the site's grid centres itself.
    if (copy) expect(source).toMatch(/className=\{?["`][^"`]*\bhero-tall-copy\b/);
  });

  it('caps the height and leaves the phone alone', () => {
    const sheet = read('packages/marketing-site/src/css/hero-tall.css');
    expect(sheet).toContain('@media (min-width: 40rem)');
    expect(sheet).toContain(
      'min(100svh - var(--hero-tall-header, 72px), var(--hero-tall-cap, 72rem))',
    );
  });
});
