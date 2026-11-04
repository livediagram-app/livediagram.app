import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// help-art.css: `help-art-as-drawn` gives back every colour the dark art scope retargets, so a figure drawn in its own
// colours in both appearances (the pixel character, Work Tracker #492) keeps all of them, not just some.
const CSS = readFileSync(fileURLToPath(new URL('./help-art.css', import.meta.url)), 'utf8');
const block = (selector: string) => {
  const at = CSS.indexOf(`${selector} {`);
  return CSS.slice(at, CSS.indexOf('}', at));
};
const tokens = (css: string) => [...css.matchAll(/(--color-[a-z]+(?:-\d+)?):/g)].map((m) => m[1]);

describe('help-art-as-drawn', () => {
  it('restores every colour dark mode retargets in the art', () => {
    const retargeted = tokens(block('.dark .help-art'));
    const restored = new Set(tokens(block('.dark .help-art .help-art-as-drawn')));
    expect(retargeted.length).toBeGreaterThan(20);
    expect(retargeted.filter((t) => !restored.has(t))).toEqual([]);
  });
});
