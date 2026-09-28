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

describe('text-optical-line', () => {
  it('centres the cap band but keeps a full line box, so no host changes height', () => {
    const rule = utility('text-optical-line');
    expect(rule).toMatch(/display:\s*inline-block/);
    expect(rule).toMatch(/text-box:\s*trim-both cap alphabetic/);
    expect(rule).toMatch(/padding-block:\s*calc\(\(1lh - 1cap\) \/ 2\)/);
    // Without text-box nothing is trimmed, so nothing is given back.
    expect(rule).toMatch(
      /@supports not \(text-box: trim-both cap alphabetic\)\s*\{\s*padding-block:\s*0/,
    );
  });

  it('gives the line back inside the clip edge, so truncate never cuts descenders', () => {
    // overflow clips at the padding edge; a margin would leave it on the baseline.
    expect(utility('text-optical-line')).not.toMatch(/margin-block/);
  });
});

describe('optical-edges', () => {
  it('pulls an edge icon in by the blank margin its Glyph reports, and by nothing without it', () => {
    const rule = utility('optical-edges');
    expect(rule).toMatch(
      /& > svg:first-child \{\s*margin-inline-start:\s*calc\(-1 \* var\(--glyph-ink-l, 0px\)\)/,
    );
    expect(rule).toMatch(
      /& > svg:last-child \{\s*margin-inline-end:\s*calc\(-1 \* var\(--glyph-ink-r, 0px\)\)/,
    );
    // Never through a centring slot: centring would split a negative margin and halve it.
    expect(rule).not.toMatch(/data-optical/);
  });
});
