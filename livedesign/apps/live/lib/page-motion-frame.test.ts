import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANIM_ORIGIN } from './page-motion-frame';

// The opening poses restate this editor's app/motion-page.css as numbers
// (@liveworkspace/page-background/motion-frame, whose own tests cover the poses): the origins a loop turns
// and scales its part from must match the stylesheet's.
describe('animOrigin', () => {
  const css = readFileSync(join(__dirname, '..', 'app', 'motion-page.css'), 'utf8');

  it.each(Object.entries(ANIM_ORIGIN))('matches the stylesheet for %s', (name, origin) => {
    const rule = css.match(new RegExp(`\\.pm-${name} \\{([^}]*)\\}`))?.[1] ?? '';
    const pct = (f: number) => (f === 0 ? '0' : `${f * 100}%`);
    expect(rule).toContain(`transform-origin: ${pct(origin[0])} ${pct(origin[1])};`);
  });
});
