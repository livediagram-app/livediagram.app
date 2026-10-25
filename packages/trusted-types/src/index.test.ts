// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInlineScript } from '@liveworkspace/vitest-config/inline-script';
import {
  INERT_PARSE_POLICY,
  MARKUP_POLICY,
  NEXTJS_POLICY,
  PROSEMIRROR_CLIPBOARD_POLICY,
  isAllowedScriptUrl,
  parseInert,
  resetTrustedTypesForTests,
  trustedHtml,
  trustedTypesBootScript,
  trustedTypesCsp,
} from './index';

// livediagram/docs/specs/016-platform/trusted-types.md: the header, our two policies and the third parties they let
// through, the same in every app.

type Created = { name: string; rules: Record<string, (s: string) => unknown> };
function stubTrustedTypes() {
  const created: Created[] = [];
  const tt = {
    createPolicy: vi.fn((name: string, rules: Created['rules']) => {
      created.push({ name, rules });
      return {
        createHTML: (s: string) => ({ trusted: name, html: rules.createHTML!(s) }),
        createScriptURL: (s: string) => rules.createScriptURL!(s),
      };
    }),
  };
  vi.stubGlobal('trustedTypes', tt);
  return { tt, created };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetTrustedTypesForTests();
});

describe('trustedTypesCsp', () => {
  it('enforces Trusted Types and names the given policies, then default', () => {
    expect(
      trustedTypesCsp([
        MARKUP_POLICY,
        INERT_PARSE_POLICY,
        NEXTJS_POLICY,
        PROSEMIRROR_CLIPBOARD_POLICY,
      ]),
    ).toBe(
      "require-trusted-types-for 'script'; trusted-types liveworkspace-markup liveworkspace-inert-parse nextjs ProseMirrorClipboard default",
    );
  });

  // Each name is written into a header: a space, a semicolon or a quote would change what it allows.
  it('refuses a name that is not one, and an explicit default or duplicates switch', () => {
    expect(() => trustedTypesCsp(['a b'])).toThrow(/policy name/);
    expect(() => trustedTypesCsp(["'allow-duplicates'"])).toThrow(/policy name/);
    expect(() => trustedTypesCsp(['x; script-src *'])).toThrow(/policy name/);
    expect(() => trustedTypesCsp(['default'])).toThrow(/policy name/);
  });
});

describe('isAllowedScriptUrl', () => {
  const page = 'https://livediagram.app';
  it("lets the app's own build scripts through, under its asset prefix", () => {
    expect(isAllowedScriptUrl('/_next/static/chunks/a.js', page, '', [])).toBe(true);
    expect(
      isAllowedScriptUrl(
        'https://livediagram.app/live/_next/static/chunks/b.js',
        page,
        '/live',
        [],
      ),
    ).toBe(true);
    expect(isAllowedScriptUrl('/live/_next/static/media/reader.worker.js', page, '/live', [])).toBe(
      true,
    );
    expect(isAllowedScriptUrl('/help/_next/static/chunks/c.js', page, '/help', [])).toBe(true);
    // liveworkspace.app's Explorer, on the app's own address: its build under /_liveworkspace.
    expect(
      isAllowedScriptUrl('/_liveworkspace/_next/static/chunks/d.js', page, '/_liveworkspace', []),
    ).toBe(true);
  });

  it("refuses another app's build, or a path outside its prefix", () => {
    expect(isAllowedScriptUrl('/live/_next/static/chunks/b.js', page, '/help', [])).toBe(false);
    expect(isAllowedScriptUrl('/_next/static/chunks/a.js', page, '/community', [])).toBe(false);
  });

  it("lets a worker start from the page's own blob: URL (Clerk's session timers), nothing else from one", () => {
    const blob = 'blob:https://livediagram.app/1234';
    expect(isAllowedScriptUrl(blob, page, '', [], 'Worker constructor')).toBe(true);
    expect(isAllowedScriptUrl(blob, page, '', [], 'HTMLScriptElement src')).toBe(false);
    expect(isAllowedScriptUrl(blob, page, '', [])).toBe(false);
    expect(
      isAllowedScriptUrl('blob:https://evil.example/1234', page, '', [], 'Worker constructor'),
    ).toBe(false);
  });

  it('lets a named third-party origin through', () => {
    const vendor = 'https://scripts.example.com';
    expect(isAllowedScriptUrl(`${vendor}/sdk/v1/sdk.js`, page, '', [vendor])).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isAllowedScriptUrl('/api/documents', page, '', [])).toBe(false);
    expect(isAllowedScriptUrl('/next/static/a.js', page, '', [])).toBe(false);
    expect(isAllowedScriptUrl('https://evil.example/_next/a.js', page, '', [])).toBe(false);
    expect(isAllowedScriptUrl('javascript:alert(1)', page, '', [])).toBe(false);
    expect(isAllowedScriptUrl('data:text/javascript,alert(1)', page, '', [])).toBe(false);
    expect(isAllowedScriptUrl('blob:https://livediagram.app/1234', page, '', [])).toBe(false);
    expect(isAllowedScriptUrl('::not a url', page, '', [])).toBe(false);
  });
});

describe('trustedHtml', () => {
  it('passes the markup through where there are no Trusted Types (the prerender)', () => {
    expect(trustedHtml('<svg/>')).toBe('<svg/>');
  });

  it('wraps it through liveworkspace-markup, created once', () => {
    const { tt } = stubTrustedTypes();
    expect(trustedHtml('<svg/>')).toEqual({ trusted: MARKUP_POLICY, html: '<svg/>' });
    trustedHtml('<g/>');
    expect(tt.createPolicy).toHaveBeenCalledOnce();
  });
});

describe('parseInert', () => {
  it('parses through liveworkspace-inert-parse into an inert document', () => {
    const { created } = stubTrustedTypes();
    const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
    const doc = parseInert('<mxfile><diagram/></mxfile>', 'application/xml');
    expect(created.map((c) => c.name)).toEqual([INERT_PARSE_POLICY]);
    expect(parse.mock.calls[0]![0]).toEqual({
      trusted: INERT_PARSE_POLICY,
      html: '<mxfile><diagram/></mxfile>',
    });
    expect(doc).toBeInstanceOf(Document);
  });

  it('parses the string itself where there are no Trusted Types', () => {
    const doc = parseInert('<mxfile><diagram/></mxfile>', 'application/xml');
    expect(doc.documentElement.nodeName).toBe('mxfile');
  });
});

describe('trustedTypesBootScript', () => {
  // The page it runs in: this window (with the Trusted Types stub when a test installs one), its
  // origin, events and URL parser, and the console the tests spy on.
  const run = (script: string) =>
    runInlineScript(script, {
      window,
      location,
      URL,
      addEventListener: (type: string, listener: EventListener) =>
        window.addEventListener(type, listener),
      console,
    });

  it('creates the default policy, which lets only allowed script URLs through and logs a refusal', () => {
    const { created } = stubTrustedTypes();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    run(trustedTypesBootScript('/live', ['https://scripts.example.com']));
    const policy = created.find((c) => c.name === 'default')!;
    expect(Object.keys(policy.rules).sort()).toEqual(['createHTML', 'createScriptURL']);
    expect(policy.rules.createScriptURL!('/live/_next/static/chunks/a.js')).toBe(
      '/live/_next/static/chunks/a.js',
    );
    expect(policy.rules.createScriptURL!('/_next/static/chunks/a.js')).toBeNull();
    expect(policy.rules.createScriptURL!('https://scripts.example.com/c.js')).toBe(
      'https://scripts.example.com/c.js',
    );
    expect(policy.rules.createScriptURL!('https://evil.example/x.js')).toBeNull();
    const own = `blob:${location.origin}/1234`;
    const worker = policy.rules.createScriptURL as unknown as (
      u: string,
      t: string,
      s: string,
    ) => unknown;
    expect(worker(own, 'TrustedScriptURL', 'Worker constructor')).toBe(own);
    expect(worker(own, 'TrustedScriptURL', 'HTMLScriptElement src')).toBeNull();
    expect(error).toHaveBeenCalledWith(
      '[trusted-types] script-url-refused https://evil.example/x.js',
    );
  });

  // React DOM makes a <script> element on a client render by parsing an empty one (inert: a script inserted
  // through innerHTML never runs). That exact string passes; any other HTML is refused and logged.
  it('lets React DOM make an empty script element, and refuses any other HTML', () => {
    const { created } = stubTrustedTypes();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    run(trustedTypesBootScript('', []));
    // As the browser calls it for a sink: the value, the type and the sink's name.
    const createHTML = created.find((c) => c.name === 'default')!.rules.createHTML as unknown as (
      html: string,
      type?: string,
      sink?: string,
    ) => unknown;
    const atSink = (html: string) => createHTML(html, 'TrustedHTML', 'Element innerHTML');
    expect(atSink('<script></script>')).toBe('<script></script>');
    expect(atSink('<script>alert(1)</script>')).toBeNull();
    expect(atSink('<img src=x onerror=alert(1)>')).toBeNull();
    expect(error).toHaveBeenCalledWith('[trusted-types] html-refused <img src=x onerror=alert(1)>');
  });

  // ProseMirror (the article editor's paste) asks `trustedTypes.defaultPolicy.createHTML(html)` first and makes its
  // own ProseMirrorClipboard policy only if that throws. Returning null there handed it an empty string, so every
  // rich paste into an article pasted nothing. Asked by hand, the default policy throws, logging no violation.
  it('throws when asked for HTML by hand, so a library falls back to its own policy', () => {
    const { created } = stubTrustedTypes();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    run(trustedTypesBootScript('', []));
    const createHTML = created.find((c) => c.name === 'default')!.rules.createHTML!;
    expect(() => createHTML('<p>Pasted <strong>bold</strong></p>')).toThrow(/no HTML on request/);
    expect(error).not.toHaveBeenCalled();
  });

  // It is inlined into the page as script: what it embeds is checked first, and never carries a raw "<".
  it('refuses a prefix or an origin that is not one, rather than embed it', () => {
    expect(() => trustedTypesBootScript('/help</script><script>alert(1)//', [])).toThrow(
      /asset prefix/,
    );
    expect(() => trustedTypesBootScript('help', [])).toThrow(/asset prefix/);
    expect(() => trustedTypesBootScript('', ['https://a.example"];alert(1)//'])).toThrow(/origin/);
    expect(() => trustedTypesBootScript('', ['javascript:alert(1)'])).toThrow(/origin/);
    expect(() => trustedTypesBootScript('/live', ['https://scripts.example.com'])).not.toThrow();
  });

  // It is inlined in a <script> element: a closing tag anywhere in it would end that element early.
  it('never closes the inline script element it is written into', () => {
    expect(trustedTypesBootScript('/live', ['https://scripts.example.com'])).not.toMatch(
      /<\/script/i,
    );
  });

  it('logs every Trusted Types violation the page raises', () => {
    stubTrustedTypes();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    run(trustedTypesBootScript('', []));
    const violation = new Event('securitypolicyviolation') as Event & Record<string, string>;
    Object.assign(violation, {
      violatedDirective: 'require-trusted-types-for',
      sample: 'Element innerHTML|<img',
    });
    window.dispatchEvent(violation);
    expect(error).toHaveBeenCalledWith(
      '[trusted-types] violation require-trusted-types-for Element innerHTML|<img',
    );
  });

  it('does nothing in a browser without Trusted Types', () => {
    expect(() => run(trustedTypesBootScript('', []))).not.toThrow();
  });
});
