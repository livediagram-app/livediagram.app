// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildTemplateTab, TEMPLATES } from '@liveplanner/templates';
import { sanitizeMarkup } from '@liveworkspace/trusted-types/sanitize';
import { renderTabToSvg } from './export-tab';

// A plan's drawing goes through the sanitiser before any sink shows it (docs/specs/016-platform/trusted-types.md
// "The sanitiser"), so the sanitiser must leave every real drawing exactly as it was: each template, rendered as the
// export preview and the split view render it, parses to the same DOM before and after, whole (set into a <div>)
// and as an <svg>'s children (the thumbnails).

const SVG_NS = 'http://www.w3.org/2000/svg';
const parsed = (markup: string, into: 'div' | 'svg' = 'div') => {
  const host =
    into === 'svg' ? document.createElementNS(SVG_NS, 'svg') : document.createElement('div');
  host.innerHTML = markup;
  return host.innerHTML;
};
// Where two renders part, with a little context, so a failure names the element the sanitiser changed.
const firstDifference = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i === a.length && i === b.length
    ? null
    : { before: a.slice(i - 80, i + 80), after: b.slice(i - 80, i + 80) };
};

describe('every template draws the same through the sanitiser', () => {
  it.each(TEMPLATES.map((t) => t.kind))('%s', (kind) => {
    const svg = renderTabToSvg(buildTemplateTab('t0', kind, kind));
    expect(svg.length).toBeGreaterThan(0);
    expect(firstDifference(parsed(svg), parsed(sanitizeMarkup(svg)))).toBeNull();
    const inner = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
    expect(
      firstDifference(parsed(inner, 'svg'), parsed(sanitizeMarkup(inner, 'svg-content'), 'svg')),
    ).toBeNull();
  });
});
