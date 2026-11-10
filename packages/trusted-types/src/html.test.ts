// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MARKUP_POLICY } from './csp';
import {
  builtMarkup,
  htmlProps,
  jsonScript,
  resetTrustedTypesForTests,
  setHtml,
  setSrcdoc,
  trustedConstant,
  type SafeHtml,
} from './html';

// The one path markup takes into a page (livediagram/docs/specs/016-platform/trusted-types.md "One path for markup").

function stubTrustedTypes() {
  const createPolicy = vi.fn((name: string, rules: { createHTML: (s: string) => string }) => ({
    createHTML: (s: string) => ({ trusted: name, html: rules.createHTML(s) }),
  }));
  vi.stubGlobal('trustedTypes', { createPolicy });
  return createPolicy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetTrustedTypesForTests();
});

describe('the SafeHtml constructors', () => {
  it('keep the markup exactly as given', () => {
    expect(trustedConstant('<script>1</script>')).toBe('<script>1</script>');
    expect(builtMarkup('<svg><g/></svg>')).toBe('<svg><g/></svg>');
  });

  it('escape every < in inline JSON, so nothing in it closes the script', () => {
    const json = jsonScript({ name: '</script><script>alert(1)</script>', n: 1 });
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ name: '</script><script>alert(1)</script>', n: 1 });
  });

  it('refuse a plain string at a sink, at the type level', () => {
    // @ts-expect-error a plain string is not SafeHtml
    const plain: SafeHtml = '<b>x</b>';
    expect(plain).toBe('<b>x</b>');
  });
});

describe('htmlProps', () => {
  it('is the markup itself where there are no Trusted Types (the prerender)', () => {
    expect(htmlProps(builtMarkup('<g/>'))).toEqual({ dangerouslySetInnerHTML: { __html: '<g/>' } });
  });

  it('mints TrustedHTML through liveworkspace-markup in the browser', () => {
    const createPolicy = stubTrustedTypes();
    expect(htmlProps(builtMarkup('<g/>'))).toEqual({
      dangerouslySetInnerHTML: { __html: { trusted: MARKUP_POLICY, html: '<g/>' } },
    });
    htmlProps(builtMarkup('<rect/>'));
    expect(createPolicy).toHaveBeenCalledOnce();
  });
});

describe('the DOM sinks', () => {
  it('setHtml replaces the children of an element with the markup', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'circle'));
    setHtml(svg, builtMarkup('<path d="M0 0L1 1"/><g/>'));
    expect([...svg.children].map((c) => c.tagName)).toEqual(['path', 'g']);
    expect(svg.firstElementChild!.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('setSrcdoc sets the document of an iframe', () => {
    const frame = document.createElement('iframe');
    setSrcdoc(frame, builtMarkup('<!doctype html><p>Hi</p>'));
    expect(frame.srcdoc).toBe('<!doctype html><p>Hi</p>');
  });

  it('write through the markup policy where there are Trusted Types', () => {
    stubTrustedTypes();
    const el = { innerHTML: '' as unknown };
    setHtml(el as unknown as Element, builtMarkup('<b/>'));
    expect(el.innerHTML).toEqual({ trusted: MARKUP_POLICY, html: '<b/>' });
  });
});
