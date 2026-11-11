// @vitest-environment jsdom
import { render, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { APPS } from '@liveworkspace/index-client';
import { APP_BACKDROP, type HeroBackdropKind } from '@liveworkspace/explorer/hero-theme';
import { startBandColours } from './start-band-colours';
import { AutomationsHeaderBand } from './AutomationsBand';
import { StartHeaderBand } from './StartHeaderBand';
import { StartTitleMark } from './StartTitleMark';
import { startHeaderTheme, useStartHeaderTheme } from './useStartHeaderTheme';

// Each product's start spec, "The header band": every app's start header wears its own Explorer hero backdrop.
const INK = { card: '#ffffff', text: '#0f172a', muted: '#475569', focus: '#0284c7' };
const band = startBandColours(INK);
const KINDS: readonly HeroBackdropKind[] = ['lanes', 'blueprint', 'typesetter', 'shapes', 'huddle'];

describe('a start header’s theme', () => {
  it('gives each app its own band, the one its Explorer hero wears', () => {
    const kinds = APPS.map((app) => startHeaderTheme(app, INK).kind);
    expect(kinds).toEqual(APPS.map((app) => APP_BACKDROP[app]));
    expect(new Set(kinds).size).toBe(APPS.length);
  });

  it('sets the Typesetter’s title in serif, every other in the heavy face', () => {
    for (const app of APPS) {
      const { kind, face } = startHeaderTheme(app, INK);
      expect(face.includes('font-serif')).toBe(kind === 'typesetter');
    }
  });

  it('works the band out again only when the palette’s colours change', () => {
    const { result, rerender } = renderHook(
      ({ ink }: { ink: typeof INK }) => useStartHeaderTheme('livediagram', ink),
      { initialProps: { ink: INK } },
    );
    const first = result.current;
    rerender({ ink: { ...INK } });
    expect(result.current).toBe(first);
    rerender({ ink: { ...INK, focus: '#be123c' } });
    expect(result.current).not.toBe(first);
  });
});

describe('the start header band', () => {
  it.each(KINDS)(
    'draws the %s band behind the header, hidden and out of the pointer’s way',
    (kind) => {
      const { container } = render(<StartHeaderBand kind={kind} band={band} />);
      const layer = container.querySelector('[data-start-band]') as HTMLElement;
      expect(layer.getAttribute('data-start-band')).toBe(kind);
      expect(layer.getAttribute('aria-hidden')).toBe('true');
      expect(layer.className).toContain('pointer-events-none');
      expect(layer.className).toContain('-z-10');
      expect(layer.style.backgroundColor).not.toBe('');
      // Its one gap piece shows only from `xl`, where the gap is wide enough.
      const gap = [...layer.querySelectorAll('*')].filter((el) =>
        String(el.getAttribute('class')).includes('xl:block'),
      );
      expect(gap).toHaveLength(1);
      expect(String(gap[0]!.getAttribute('class'))).toContain('hidden');
    },
  );

  it('runs up under a phone sheet’s grab handle only where asked', () => {
    const { container, rerender } = render(<StartHeaderBand kind="lanes" band={band} />);
    const layer = () => container.querySelector('[data-start-band]') as HTMLElement;
    expect(layer().className).not.toContain('max-sm:top-');
    rerender(<StartHeaderBand kind="lanes" band={band} underHandle />);
    expect(layer().className).toContain('max-sm:top-');
  });

  it('keeps every motion off under reduced motion', () => {
    for (const kind of KINDS) {
      const { container, unmount } = render(<StartHeaderBand kind={kind} band={band} />);
      for (const el of container.querySelectorAll('[class*="animate-"]')) {
        const animations = String(el.getAttribute('class'))
          .split(/\s+/)
          .filter((c) => c.includes('animate-'));
        for (const c of animations) expect(c.startsWith('motion-safe:')).toBe(true);
      }
      unmount();
    }
  });

  it.each(KINDS)('marks the title with the %s motif', (kind) => {
    const { container } = render(<StartTitleMark kind={kind} band={band} />);
    const mark = container.querySelector('[data-start-title-mark]')!;
    expect(mark.getAttribute('data-start-title-mark')).toBe(kind);
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.querySelector('svg *')).not.toBeNull();
  });
});

// liveplanner's docs/specs/026-plan/automations.md "The Automations screen": the same band, its own pieces.
describe('the Automations band', () => {
  it('draws its own texture and pieces in the band, hidden and out of the pointer’s way', () => {
    const { container } = render(<AutomationsHeaderBand band={band} />);
    const layer = container.querySelector('[data-start-band]') as HTMLElement;
    expect(layer.getAttribute('data-start-band')).toBe('automations');
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.className).toContain('pointer-events-none');
    expect(layer.style.backgroundImage).toContain('radial-gradient');
    // No lanes: the flow instead, shown only from `lg`, where there is room beside the words.
    expect(layer.querySelector('.flex-1')).toBeNull();
    const flow = layer.querySelector('[data-automations-flow]')!;
    expect(String(flow.getAttribute('class'))).toMatch(/\bhidden\b.*\blg:block\b/);
    // The corner pieces show at every size.
    const corners = [...layer.children].filter((el) => el !== flow);
    expect(corners).toHaveLength(2);
    for (const el of corners) expect(String(el.getAttribute('class'))).not.toContain('hidden');
    // One motion, played twice, and only where motion is welcome.
    const moving = layer.querySelectorAll('[class*="animate-"]');
    expect(moving).toHaveLength(1);
    expect(String(moving[0]!.getAttribute('class'))).toContain('motion-safe:animate-empty-ring');
    expect(String(moving[0]!.getAttribute('class'))).toContain('[animation-iteration-count:2]');
  });

  it('marks the title with a bolt, the app’s own glyph otherwise', () => {
    const { container, rerender } = render(
      <StartTitleMark kind="lanes" band={band} variant="automations" />,
    );
    const mark = () => container.querySelector('[data-start-title-mark]')!;
    expect(mark().getAttribute('data-start-title-mark')).toBe('automations');
    expect(mark().querySelectorAll('path')).toHaveLength(1);
    rerender(<StartTitleMark kind="lanes" band={band} />);
    expect(mark().getAttribute('data-start-title-mark')).toBe('lanes');
  });
});
