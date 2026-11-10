import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { escapesUnlisted, isLayoutFile, usesEscapeHatch } from './sinks-suite';

// The rules every app's sinks test applies (livediagram/docs/specs/016-platform/trusted-types.md "The sanitiser"),
// on sources small enough to read.

// That no sink is raw at all is the raw HTML guard's (.github/scripts/raw-html-guard.mjs, with its own tests).

describe('escapesUnlisted', () => {
  const call = '<g {...htmlProps(builtMarkup(markup))} />';
  it('allows the escape hatch in a layout and a listed file alone', () => {
    expect(escapesUnlisted('apps/editor/app/layout.tsx', call, [])).toBe(false);
    expect(escapesUnlisted('apps/editor/app/new/layout.tsx', call, [])).toBe(false);
    expect(escapesUnlisted('apps/editor/lib/ink.ts', call, ['apps/editor/lib/ink.ts'])).toBe(false);
    expect(escapesUnlisted('apps/editor/lib/preview.ts', call, ['apps/editor/lib/ink.ts'])).toBe(
      true,
    );
    expect(escapesUnlisted('apps/editor/app/page.tsx', call, [])).toBe(true);
  });

  it('ignores a file that only uses the sanitiser or inline JSON', () => {
    for (const safe of [
      '{...htmlProps(sanitizedHtml(markup))}',
      '{...htmlProps(jsonScript(data))}',
    ])
      expect(escapesUnlisted('apps/editor/lib/preview.ts', safe, [])).toBe(false);
  });

  it('counts either constructor that vets nothing', () => {
    expect(usesEscapeHatch("const BOOT = trustedConstant('(function(){})()');")).toBe(true);
    expect(usesEscapeHatch('setHtml(g, builtMarkup(part.svg));')).toBe(true);
    expect(usesEscapeHatch('// builtMarkup is the escape hatch')).toBe(false);
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
