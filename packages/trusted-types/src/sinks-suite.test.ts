import { describe, expect, it } from 'vitest';
import { escapesUnlisted, rawDomWrites, rawHtmlProps } from './sinks-suite';

// The rules every app's sinks test applies (livediagram/docs/specs/016-platform/trusted-types.md "The sanitiser"),
// on sources small enough to read.

describe('rawHtmlProps', () => {
  it('lets through either helper, and names anything else', () => {
    const source = [
      '<div dangerouslySetInnerHTML={{ __html: trustedHtml(ICON) }} />',
      "<div dangerouslySetInnerHTML={{ __html: sanitizedHtml(svg, 'svg-content') }} />",
      '<div dangerouslySetInnerHTML={{ __html: markup }} />',
    ].join('\n');
    expect(rawHtmlProps('a.tsx', source)).toEqual(['a.tsx: markup }} />']);
  });
});

describe('rawDomWrites', () => {
  it('names a hand-written innerHTML, outerHTML, srcdoc or insertAdjacentHTML', () => {
    const source = [
      'el.innerHTML = html;',
      'el.outerHTML = html;',
      'frame.srcdoc = html;',
      "el.insertAdjacentHTML('beforeend', html);",
      'if (el.innerHTML === html) {}',
    ].join('\n');
    expect(rawDomWrites('a.ts', source)).toEqual([
      'a.ts: .innerHTML =',
      'a.ts: .outerHTML =',
      'a.ts: .srcdoc =',
      'a.ts: insertAdjacentHTML(',
    ]);
  });

  it('lets through either helper', () => {
    const source = [
      'g.innerHTML = trustedHtml(part.svg) as string;',
      "frame.srcdoc = sanitizedHtml(html, 'document') as string;",
      "el.insertAdjacentHTML('beforeend', sanitizedHtml(html));",
    ].join('\n');
    expect(rawDomWrites('a.ts', source)).toEqual([]);
  });
});

describe('escapesUnlisted', () => {
  const call = 'x.innerHTML = trustedHtml(markup) as string;';
  it('allows the escape hatch in a layout and a listed file alone', () => {
    expect(escapesUnlisted('apps/editor/app/layout.tsx', call, [])).toBe(false);
    expect(escapesUnlisted('apps/editor/app/new/layout.tsx', call, [])).toBe(false);
    expect(escapesUnlisted('apps/editor/lib/ink.ts', call, ['apps/editor/lib/ink.ts'])).toBe(false);
    expect(escapesUnlisted('apps/editor/lib/preview.ts', call, ['apps/editor/lib/ink.ts'])).toBe(
      true,
    );
    expect(escapesUnlisted('apps/editor/app/page.tsx', call, [])).toBe(true);
  });

  it('ignores a file that only uses the sanitiser', () => {
    expect(escapesUnlisted('apps/editor/lib/preview.ts', 'sanitizedHtml(markup)', [])).toBe(false);
  });
});
