import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StickyWindowBar } from './StickyWindowBar';
import { WINDOW_META } from './windows';

// The sticky window bar on a phone (docs/specs/017-telemetry/telemetry.md, the condensed sticky selector): the
// three full names ran 8px past a 390px screen, so below `sm` each pill shows its short name (its
// accessible name stays the full one) and every pill is 44px tall to tap on a touch screen.

const html = renderToStaticMarkup(
  <StickyWindowBar
    watchRef={createRef<HTMLElement>()}
    active="last7"
    onSelect={() => {}}
    views={[]}
    view=""
    onSelectView={() => {}}
  />,
);

describe('StickyWindowBar on a phone', () => {
  it('gives every window a short name that is no longer than its full one', () => {
    expect(WINDOW_META.map((w) => w.short)).toEqual(['Today', '7 days', '30 days']);
    for (const w of WINDOW_META) expect(w.short.length).toBeLessThanOrEqual(w.label.length);
  });

  it('shows the short name below sm and the full one from sm, named in full', () => {
    for (const w of WINDOW_META) {
      expect(html).toContain(`aria-label="${w.label}"`);
      expect(html).toContain(`<span class="sm:hidden">${w.short}</span>`);
      expect(html).toContain(`<span class="max-sm:hidden">${w.label}</span>`);
    }
  });

  it('pads each pill to a 44px tap area without widening it', () => {
    const pills = [...html.matchAll(/<button[^>]*aria-pressed[^>]*class="([^"]*)"/g)].map(
      (m) => m[1]!,
    );
    expect(pills).toHaveLength(WINDOW_META.length);
    for (const c of pills) {
      expect(c).toMatch(/\btouch-target-y\b/);
      expect(c).toMatch(/\bpx-2\.5\b/);
      expect(c).toMatch(/\bsm:px-4\b/);
      expect(c).toMatch(/\bwhitespace-nowrap\b/);
    }
  });
});
