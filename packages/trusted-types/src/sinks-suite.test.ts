import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { escapesUnlisted, isLayoutFile, rawDomWrites, rawHtmlProps } from './sinks-suite';

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

describe('isLayoutFile', () => {
  it('takes a layout.tsx under an app folder at any depth, and nothing else', () => {
    for (const yes of [
      'app/layout.tsx',
      'apps/editor/app/layout.tsx',
      'apps/editor/app/new/layout.tsx',
      'apps/editor/app/(site)/docs/layout.tsx',
    ])
      expect(isLayoutFile(yes), yes).toBe(true);
    for (const no of [
      'layout.tsx',
      'apps/editor/layout.tsx',
      'apps/editor/app/page.tsx',
      'apps/editor/app/layout.ts',
      'apps/editor/app/my-layout.tsx',
      'apps/editor/myapp/layout.tsx',
      'apps/editor/app/layout.tsx/x.tsx',
    ])
      expect(isLayoutFile(no), no).toBe(false);
  });

  // CodeQL js/polynomial-redos: the regex this replaced backtracked on 'app/' followed by many '/app/a'. A 100,000
  // segment worst case answers in well under 20 ms of CPU time (x10 for CI and coverage).
  it('stays linear on a long path of app segments', () => {
    const hostile = 'app/' + '/app/a'.repeat(100_000);
    let answer = true;
    const ms = cpuMsOf(() => {
      answer = isLayoutFile(hostile);
    });
    expect(answer).toBe(false);
    expect(ms).toBeLessThan(cpuBudgetMs(20));
  });
});
