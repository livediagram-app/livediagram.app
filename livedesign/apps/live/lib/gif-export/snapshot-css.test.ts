import { describe, expect, it } from 'vitest';
import { collectCss, pinRules, withFullMotion } from './snapshot-css';

// docs/specs/020-import-export/blueprints/animated-gif-export.md "The snapshot", steps 5 and 7.
const style = (cssText: string) => ({ cssText });
const group = (head: string, rules: { cssText: string }[], mediaText?: string) => ({
  cssText: `${head} { ... }`,
  cssRules: rules,
  ...(mediaText !== undefined ? { media: { mediaText } } : {}),
});

describe('pinning animations', () => {
  it('stands each animation where it is t ms after its start, paused', () => {
    const rules = pinRules([{ id: 4, pseudo: '::before', delaysMs: [0, -1500] }], 250);
    expect(rules).toContain(
      '[data-gif-id="4"]::before{animation-delay:-250ms,-1750ms!important;animation-play-state:paused!important}',
    );
  });

  it('pauses everything else where it stands', () => {
    expect(pinRules([], 0)).toBe('*,*::before,*::after{animation-play-state:paused!important}');
  });

  it('starts a delayed reveal later in the clock', () => {
    expect(pinRules([{ id: 0, pseudo: '', delaysMs: [400] }], 100)).toContain(
      'animation-delay:300ms!important',
    );
  });
});

describe('collecting the stylesheets', () => {
  it('keeps every rule, grouping rules round their own', () => {
    const css = collectCss([
      { cssRules: [style('.a{color:red}'), group('@layer utilities', [style('.b{top:0}')])] },
    ]);
    expect(css).toContain('.a{color:red}');
    expect(css).toContain('@layer utilities{.b{top:0}}');
  });

  it('drops Reduce Motion blocks and unwraps no-preference ones, at any depth', () => {
    const css = collectCss([
      {
        cssRules: [
          group(
            '@media (prefers-reduced-motion: reduce)',
            [style('.x{animation:none}')],
            '(prefers-reduced-motion: reduce)',
          ),
          group('@layer utilities', [
            group(
              '@media (prefers-reduced-motion: no-preference)',
              [style('.y{animation:spin 1s}')],
              '(prefers-reduced-motion: no-preference)',
            ),
          ]),
          group('@media (min-width: 600px)', [style('.z{left:0}')], '(min-width: 600px)'),
        ],
      },
    ]);
    expect(css).not.toContain('.x{animation:none}');
    expect(css).toContain('@layer utilities{.y{animation:spin 1s}}');
    expect(css).toContain('@media (min-width: 600px){.z{left:0}}');
  });

  it('skips a stylesheet it may not read (the cross-origin webfonts)', () => {
    const locked = {
      get cssRules(): never {
        throw new DOMException('cross-origin', 'SecurityError');
      },
    };
    expect(collectCss([locked, { cssRules: [style('.a{}')] }])).toBe('.a{}');
  });
});

describe('reading in full motion', () => {
  const classes = (initial: string[]) => {
    const set = new Set(initial);
    return {
      set,
      classList: {
        contains: (c: string) => set.has(c),
        add: (c: string) => void set.add(c),
        remove: (c: string) => void set.delete(c),
      },
    };
  };

  it('lifts Reduce Motion for the read and puts it back', () => {
    const reduce = {
      cssText: '',
      cssRules: [],
      media: { mediaText: '(prefers-reduced-motion: reduce)' },
    };
    const safe = {
      cssText: '',
      cssRules: [],
      media: { mediaText: '(prefers-reduced-motion: no-preference)' },
    };
    const wide = { cssText: '', cssRules: [], media: { mediaText: '(min-width: 600px)' } };
    const layer = { cssText: '@layer x', cssRules: [safe] };
    const html = classes(['dark', 'reduce-motion']);
    const seen = withFullMotion([{ cssRules: [reduce, layer, wide] }], html, () => ({
      reduce: reduce.media.mediaText,
      safe: safe.media.mediaText,
      wide: wide.media.mediaText,
      reduced: html.set.has('reduce-motion'),
    }));
    expect(seen).toEqual({
      reduce: 'not all',
      safe: 'all',
      wide: '(min-width: 600px)',
      reduced: false,
    });
    expect(reduce.media.mediaText).toBe('(prefers-reduced-motion: reduce)');
    expect(safe.media.mediaText).toBe('(prefers-reduced-motion: no-preference)');
    expect(html.set.has('reduce-motion')).toBe(true);
  });

  it('puts it back when the read throws, and leaves a page without it alone', () => {
    const html = classes([]);
    expect(() =>
      withFullMotion([], html, () => {
        throw new Error('read failed');
      }),
    ).toThrow('read failed');
    expect(html.set.has('reduce-motion')).toBe(false);
  });
});
