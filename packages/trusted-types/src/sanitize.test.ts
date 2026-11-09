// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { MARKUP_POLICY } from './csp';
import { resetTrustedTypesForTests } from './index';
import {
  SANITISE_CACHE_CHARS,
  SANITISE_CACHE_ENTRIES,
  resetSanitizerForTests,
  sanitiseCacheSize,
  sanitizeMarkup,
  sanitizedHtml,
} from './sanitize';

// livediagram/docs/specs/016-platform/trusted-types.md "The sanitiser": what people's markup loses, what our own
// drawings keep, and what it costs.

afterEach(() => {
  vi.unstubAllGlobals();
  resetTrustedTypesForTests();
  resetSanitizerForTests();
});

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">';
const svg = (inner: string) => sanitizeMarkup(`${SVG}${inner}</svg>`);
// The markup as a browser would hold it: parsed and written back, so a test compares what renders, not spelling.
const parsed = (markup: string, into: 'div' | 'svg' = 'div') => {
  const host = document.createElementNS(
    into === 'svg' ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml',
    into,
  );
  host.innerHTML = markup;
  return host.innerHTML;
};

describe('sanitizeMarkup strips what could run', () => {
  const payloads: [string, string, RegExp][] = [
    ['a script', '<script>alert(1)</script>', /script|alert/i],
    ['an event handler', '<rect onload="alert(1)" onclick="alert(1)"/>', /on(load|click)|alert/i],
    ['a javascript: link', '<a href="javascript:alert(1)"><text>x</text></a>', /javascript/i],
    [
      'a javascript: link, by xlink',
      '<a xlink:href=" JaVaScRiPt:alert(1)"><text>x</text></a>',
      /javascript/i,
    ],
    [
      'a foreignObject',
      '<foreignObject><div onclick="alert(1)"><img src="x" onerror="alert(1)"></div></foreignObject>',
      /foreignObject|onclick|onerror|<img/i,
    ],
    ['an outside use', '<use href="https://evil.example/x.svg#a"/>', /use|evil/i],
    ['a data: use', '<use href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=#a"/>', /use|data:/i],
    ['an inside use', '<use href="#a"/>', /<use/i],
    [
      'an animation that rewrites a link',
      '<a><animate attributeName="href" to="javascript:alert(1)"/></a>',
      /animate|javascript/i,
    ],
    ['a set', '<set attributeName="onmouseover" to="alert(1)"/>', /<set|alert/i],
    ['a style breakout', '<style><img src="x" onerror="alert(1)"></style>', /onerror|alert|<img/i],
    [
      'a closing style breakout',
      '<style></style><img src="x" onerror="alert(1)">',
      /onerror|<img/i,
    ],
    ['an iframe', '<iframe src="https://evil.example"></iframe>', /iframe|evil/i],
    ['an outside gradient', '<linearGradient href="https://evil.example/g.svg#g"/>', /evil/i],
    ['a blob: link', '<a href="blob:https://x.example/1"><text>x</text></a>', /blob:/i],
  ];
  it.each(payloads)('%s', (_, payload, banned) => {
    const out = svg(payload);
    expect(out).not.toMatch(banned);
    expect(out.startsWith('<svg')).toBe(true);
  });

  it('strips a script and a handler from a whole document', () => {
    const out = sanitizeMarkup(
      '<!doctype html><html><head><script>alert(1)</script><style>@page{margin:0}</style></head><body onload="alert(1)"><section class="sheet"><svg><rect/></svg></section><img src="x" onerror="alert(1)"></body></html>',
      'document',
    );
    expect(out).not.toMatch(/script|onload|onerror|alert/i);
    expect(out).toContain('<style>@page{margin:0}</style>');
    expect(out).toContain('<section class="sheet"><svg><rect></rect></svg></section>');
  });

  it("strips from a drawing's children, and keeps them SVG", () => {
    const out = sanitizeMarkup(
      '<g onclick="alert(1)"><path d="M0 0L5 5"/><linearGradient id="g"/><script>alert(1)</script></g>',
      'svg-content',
    );
    expect(out).toBe('<g><path d="M0 0L5 5"></path><linearGradient id="g"></linearGradient></g>');
    expect(sanitizeMarkup('<script>alert(1)</script>', 'svg-content')).toBe('');
  });
});

describe('sanitizeMarkup keeps what our drawings use', () => {
  // A drawing in the shape the headless renderers write: fonts, gradients, clips, markers, filters, links, pictures.
  const drawing =
    `${SVG.replace('>', ' width="100" height="80" role="img" aria-label="Diagram" class="lvd" data-tab="t1" font-family="Inter, &quot;Helvetica Neue&quot;">')}` +
    '<defs><style type="text/css">@import url("https://fonts.googleapis.com/css2?family=Inter");.lvd text{fill:#123}</style>' +
    '<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" x2="1"><stop offset="0" stop-color="#f00" stop-opacity=".5"/></linearGradient>' +
    '<clipPath id="c"><rect width="5" height="5" rx="1"/></clipPath>' +
    '<marker id="m" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto-start-reverse"><path d="M0 0L4 2L0 4z"/></marker>' +
    '<filter id="f" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2"/><feOffset dx="1"/><feMerge><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<pattern id="p" patternUnits="userSpaceOnUse" width="4" height="4"><circle cx="2" cy="2" r="1"/></pattern></defs>' +
    '<rect width="100" height="80" fill="url(#p)"/>' +
    '<g transform="translate(4 4) rotate(3)" opacity="0.9" clip-path="url(#c)" filter="url(#f)">' +
    '<path d="M0 0C1 1 2 2 3 3" fill="none" stroke="url(#g)" stroke-width="2" stroke-dasharray="4 2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" paint-order="stroke" marker-end="url(#m)"/>' +
    '<text x="5" y="9" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" xml:space="preserve">Fish &amp; chips &lt;3<tspan dy="1.2em" x="5">Two</tspan></text>' +
    '<textPath href="#p">On a path</textPath><title>Box</title><desc>A box</desc></g>' +
    '<a href="https://example.com/x?a=1&amp;b=2" target="_blank"><text>Link</text></a>' +
    '<a href="#tab-2"><text>Tab</text></a>' +
    '<image href="data:image/png;base64,iVBORw0KGgo=" width="5" height="5" preserveAspectRatio="xMidYMid slice"/>' +
    '<image href="blob:http://localhost:3000/5b3c" width="5" height="5"/>' +
    '<image href="/live/api/images/abc" width="5" height="5"/>' +
    '<image xlink:href="https://cdn.example/a.png" width="5" height="5"/>' +
    '<ellipse cx="1" cy="1" rx="1" ry="1"/><polyline points="0,0 1,1"/><polygon points="0,0 1,1 1,0"/><line x1="0" x2="1" y1="0" y2="1"/>' +
    '</svg>';

  it('renders a full drawing the same', () => {
    expect(parsed(sanitizeMarkup(drawing))).toBe(parsed(drawing));
  });

  it("renders a drawing's children the same, inside an <svg>", () => {
    const inner = drawing.slice(drawing.indexOf('>') + 1, -'</svg>'.length);
    expect(parsed(sanitizeMarkup(inner, 'svg-content'), 'svg')).toBe(parsed(inner, 'svg'));
  });

  it('keeps a whole print document', () => {
    const page =
      '<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>@page s1{size:10px 10px;margin:0}\n.sheet>svg{display:block}</style></head>' +
      `<body><section class="sheet" style="page:s1;width:10px;height:10px">${drawing}</section></body></html>`;
    const out = sanitizeMarkup(page, 'document');
    const body = (html: string) =>
      new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    expect(body(out)).toBe(body(page));
    expect(out).toContain('@page s1{size:10px 10px;margin:0}');
  });
});

describe('sanitizedHtml', () => {
  it('answers the sanitised text without Trusted Types', () => {
    expect(sanitizedHtml(`${SVG}<rect onclick="x"/></svg>`)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect></rect></svg>',
    );
  });

  // DOMPurify parses and answers through our markup policy (every header names it), never a policy of its own.
  it('mints through the markup policy under Trusted Types, and makes no policy of its own', () => {
    const names: string[] = [];
    vi.stubGlobal('trustedTypes', {
      createPolicy: vi.fn((name: string, rules: { createHTML: (s: string) => string }) => {
        names.push(name);
        const make = (s: string) => ({ trusted: name, toString: () => rules.createHTML(s) });
        return { createHTML: make, createScriptURL: make };
      }),
    });
    const out = sanitizedHtml(`${SVG}<script>x</script><rect/></svg>`) as unknown as {
      trusted: string;
    };
    expect(out.trusted).toBe(MARKUP_POLICY);
    expect(String(out)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect></rect></svg>',
    );
    expect(names).toEqual([MARKUP_POLICY]);
    expect(String(sanitizedHtml('<g><rect/></g>', 'svg-content'))).toBe('<g><rect></rect></g>');
  });

  it('answers nothing where there is no DOM to sanitise with', () => {
    vi.stubGlobal('window', undefined);
    expect(sanitizedHtml(`${SVG}<rect/></svg>`)).toBe('');
    expect(sanitiseCacheSize().entries).toBe(0);
  });

  it('answers a repeat from its cache, per profile', () => {
    const markup = '<g><rect/></g>';
    const first = sanitizedHtml(markup, 'svg-content');
    expect(sanitizedHtml(markup, 'svg-content')).toBe(first);
    expect(sanitiseCacheSize().entries).toBe(1);
    // The same text as a whole drawing is a different answer (it has no <svg>, so nothing survives).
    expect(sanitizedHtml(markup, 'svg')).toBe('');
    expect(sanitiseCacheSize().entries).toBe(0);
    expect(sanitizedHtml(markup, 'svg-content')).toBe(first);
  });

  it('keeps its cache within its entries and characters, least recently used out first', () => {
    for (let i = 0; i < SANITISE_CACHE_ENTRIES + 10; i++)
      sanitizedHtml(`<rect x="${i}"/>`, 'svg-content');
    expect(sanitiseCacheSize().entries).toBe(SANITISE_CACHE_ENTRIES);
    expect(sanitizedHtml('<rect x="0"/>', 'svg-content')).toBe('<rect x="0"></rect>');
    expect(sanitizedHtml('<rect x="9"/>', 'svg-content')).toBe('<rect x="9"></rect>');
    const big = `<text>${'a'.repeat(SANITISE_CACHE_CHARS)}</text>`;
    expect(String(sanitizedHtml(big, 'svg-content')).length).toBeGreaterThan(SANITISE_CACHE_CHARS);
    // Too big to hold: answered, not kept.
    expect(sanitiseCacheSize().entries).toBe(SANITISE_CACHE_ENTRIES);
    // Two drawings that together pass the character bound: every older result goes, then the first of the two.
    const sized = (c: string) => `<text>${c.repeat(SANITISE_CACHE_CHARS * 0.3)}</text>`;
    sanitizedHtml(sized('b'), 'svg-content');
    sanitizedHtml(sized('c'), 'svg-content');
    expect(sanitiseCacheSize().entries).toBe(1);
    expect(sanitiseCacheSize().chars).toBeLessThanOrEqual(SANITISE_CACHE_CHARS);
  });

  // A big drawing (a split view of a busy tab, an export preview): 4,000 boxes with labels, about 1 MB of SVG.
  it('sanitises a 1 MB drawing within its CPU budget, and a repeat in no time', () => {
    const boxes = Array.from(
      { length: 4000 },
      (_, i) =>
        `<g transform="translate(${i % 80} ${i >> 6})" data-element="e${i}"><rect width="120" height="60" rx="8" fill="#eef" stroke="#335" stroke-width="2"/>` +
        `<text x="60" y="30" text-anchor="middle" dominant-baseline="middle" font-size="14">Box number ${i} &amp; friends</text></g>`,
    ).join('');
    const markup = `${SVG}${boxes}</svg>`;
    expect(markup.length).toBeGreaterThan(900_000);
    let out = '';
    const ms = cpuMsOf(() => (out = String(sanitizedHtml(markup))));
    if (process.env.SANITISE_TIMING) console.log(`sanitise ${markup.length} chars: ${ms} ms CPU`);
    expect(ms).toBeLessThan(cpuBudgetMs(3000));
    expect(out).toContain('Box number 3999 &amp; friends');
    expect(cpuMsOf(() => sanitizedHtml(markup))).toBeLessThan(cpuBudgetMs(5));
  });
});
