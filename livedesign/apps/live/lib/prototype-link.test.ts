import { describe, expect, it } from 'vitest';
import { wantsPrototype, withPrototype } from './prototype-link';

// docs/specs/007-editor/wireframe-pages.md "Sharing a prototype".
describe('the prototype parameter', () => {
  it('asks for Prototype mode when present, unless it says no', () => {
    expect(wantsPrototype('?s=abc&prototype')).toBe(true);
    expect(wantsPrototype('?s=abc&prototype=1')).toBe(true);
    expect(wantsPrototype('?prototype=0')).toBe(false);
    expect(wantsPrototype('?prototype=false')).toBe(false);
    expect(wantsPrototype('?s=abc&inspect=1')).toBe(false);
    expect(wantsPrototype('')).toBe(false);
  });

  it('adds itself once, keeping the rest of the link, a relative one relative', () => {
    expect(withPrototype('https://www.livedesign.app/design/shared?s=abc')).toBe(
      'https://www.livedesign.app/design/shared?s=abc&prototype=1',
    );
    expect(withPrototype('https://x.test/d?prototype&s=a#t')).toBe(
      'https://x.test/d?prototype=1&s=a#t',
    );
    expect(withPrototype('/design/shared?s=abc')).toBe('/design/shared?s=abc&prototype=1');
  });
});
