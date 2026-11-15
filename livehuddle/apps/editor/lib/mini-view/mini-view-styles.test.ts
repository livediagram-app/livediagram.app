// @vitest-environment jsdom
// The mini view's look (docs/specs/008-canvas/avatar-mode.md "The mini view"): the opener's sheets and theme copied in.
import { describe, expect, it } from 'vitest';
import { mirrorDocumentLook } from './mini-view-styles';

function fakeSheets(sheets: Partial<CSSStyleSheet>[]): Document {
  const from = document.implementation.createHTMLDocument('opener');
  Object.defineProperty(from, 'styleSheets', { value: sheets });
  return from;
}

const pipDocument = () => document.implementation.createHTMLDocument('pip');

describe('mirrorDocumentLook', () => {
  it('links a linked sheet by its address and copies an inline one rule by rule', () => {
    const from = fakeSheets([
      { href: 'https://example.test/app.css' },
      {
        href: null,
        cssRules: [{ cssText: '.a { color: red; }' }, { cssText: '.b { margin: 0px; }' }] as never,
      },
    ]);
    const to = pipDocument();
    mirrorDocumentLook(from, to);
    const link = to.head.querySelector('link')!;
    expect(link.rel).toBe('stylesheet');
    expect(link.href).toBe('https://example.test/app.css');
    expect(to.head.querySelector('style')!.textContent).toBe(
      '.a { color: red; }\n.b { margin: 0px; }',
    );
  });

  it('skips an inline sheet that cannot be read', () => {
    const unreadable = { href: null } as Partial<CSSStyleSheet>;
    Object.defineProperty(unreadable, 'cssRules', {
      get() {
        throw new Error('SecurityError');
      },
    });
    const to = pipDocument();
    mirrorDocumentLook(fakeSheets([unreadable]), to);
    expect(to.head.querySelector('style')).toBeNull();
  });

  it('carries the theme class, inline custom properties and language', () => {
    const from = fakeSheets([]);
    from.documentElement.className = 'dark font-ui';
    from.documentElement.setAttribute('style', '--ui-scale: 1.1');
    from.documentElement.lang = 'en-GB';
    const to = pipDocument();
    mirrorDocumentLook(from, to);
    expect(to.documentElement.className).toBe('dark font-ui');
    expect(to.documentElement.style.getPropertyValue('--ui-scale')).toBe('1.1');
    expect(to.documentElement.lang).toBe('en-GB');
    expect(to.documentElement.style.colorScheme).toBe('dark');
  });

  it('reads light without the dark class', () => {
    const to = pipDocument();
    mirrorDocumentLook(fakeSheets([]), to);
    expect(to.documentElement.style.colorScheme).toBe('light');
    expect(to.documentElement.lang).toBe('');
  });
});
