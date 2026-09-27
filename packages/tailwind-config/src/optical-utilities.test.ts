import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The optical utilities (docs/specs/004-interface-design/optical-alignment.md, blueprint "Utilities").
const THEME_CSS = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
const utility = (name: string) =>
  new RegExp(`@utility ${name} \\{([\\s\\S]*?)\\n\\}`).exec(THEME_CSS)?.[1] ?? '';

describe('text-optical-centre', () => {
  it('trims the text box to cap height and baseline, with a fallback nudge', () => {
    const rule = utility('text-optical-centre');
    expect(rule).toMatch(/display:\s*inline-block/);
    expect(rule).toMatch(/line-height:\s*1;/);
    expect(rule).toMatch(/text-box:\s*trim-both cap alphabetic/);
    expect(rule).toMatch(
      /@supports not \(text-box: trim-both cap alphabetic\)\s*\{\s*transform:\s*translateY\(0\.1em\)/,
    );
  });
});

describe('text-optical-caps', () => {
  it('tracks capitals and gives back the letter-space after the last one (D42)', () => {
    const rule = utility('text-optical-caps');
    expect(rule).toMatch(/text-transform:\s*uppercase/);
    expect(rule).toMatch(/letter-spacing:\s*var\(--optical-tracking, 0\.05em\)/);
    expect(rule).toMatch(/margin-inline-end:\s*calc\(-1 \* var\(--optical-tracking, 0\.05em\)\)/);
  });
});
