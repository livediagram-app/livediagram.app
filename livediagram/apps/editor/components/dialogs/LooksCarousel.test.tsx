// @vitest-environment jsdom

// The Looks carousel (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks", "Mashup").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookSettings } from '@/lib/look-mashup';
import { SEASONAL_LOOKS, seasonalLooksFor } from '@/lib/seasonal-looks';
import {
  TAB_LOOKS,
  activeLookId,
  withLookApplied,
  type LookSettings,
  type TabLook,
} from '@/lib/tab-looks';
import { track } from '@/lib/telemetry';
import { LooksCarousel } from './LooksCarousel';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => cleanup());

const MASHUP = 'Mashup: a random look, press for another';
const UNTOUCHED: LookSettings = { theme: undefined, finish: undefined, font: undefined };

const cards = () =>
  screen
    .getAllByRole('button')
    .filter((b) => b.hasAttribute('aria-pressed') && b.textContent !== 'Seasonal')
    // The name, skipping a seasonal card's season line above it.
    .map(
      (b) =>
        [...b.querySelectorAll('span > span')].find((s) => !s.className.includes('uppercase'))
          ?.textContent,
    );
const seasonsShown = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.querySelector('span > span.uppercase')?.textContent)
    .filter(Boolean);

// Renders the carousel as the dialog does: a pick re-renders it with the tab's new settings.
function host(initial: LookSettings = UNTOUCHED) {
  const picks: TabLook[] = [];
  const props = (settings: LookSettings) => ({
    settings,
    activeLook: activeLookId(settings),
    headingClass: '',
    onPickLook: (look: string | TabLook) => {
      if (typeof look === 'string') return;
      picks.push(look);
      view.rerender(<LooksCarousel {...props(lookSettings(look))} />);
    },
  });
  const view = render(<LooksCarousel {...props(initial)} />);
  return { picks, mashup: () => screen.getByRole('button', { name: MASHUP }) };
}

describe('the Looks finish filter', () => {
  it('shows the Mashup card and every look, then only the looks of the chosen finish', () => {
    render(
      <LooksCarousel
        settings={UNTOUCHED}
        activeLook={undefined}
        onPickLook={() => {}}
        headingClass=""
      />,
    );
    expect(cards()).toEqual(['Mashup', ...TAB_LOOKS.map((l) => l.label)]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter looks by finish' }), {
      target: { value: 'sketch' },
    });
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'LooksFinishFilter');
    const sketch = TAB_LOOKS.filter((l) => l.finish === 'sketch').map((l) => l.label);
    expect(sketch.length).toBeGreaterThan(0);
    expect(cards()).toEqual(['Mashup', ...sketch]);
  });
});

describe('the Mashup card', () => {
  it('applies the mashup it shows first, then rolls a new one on every press', () => {
    const h = host();
    expect(h.mashup().getAttribute('aria-pressed')).toBe('false');
    const shown = h.mashup().textContent;
    fireEvent.click(h.mashup());
    expect(h.picks).toHaveLength(1);
    // The first press applies exactly what the card showed, and the card is now the tab's look.
    expect(shown).toContain(h.picks[0]!.description);
    expect(h.mashup().getAttribute('aria-pressed')).toBe('true');
    for (let i = 1; i <= 5; i++) {
      fireEvent.click(h.mashup());
      expect(h.picks).toHaveLength(i + 1);
      const [before, after] = h.picks.slice(-2) as [TabLook, TabLook];
      expect(after).not.toEqual(before);
      expect(h.mashup().textContent).toContain(after.description);
      expect(h.mashup().getAttribute('aria-pressed')).toBe('true');
    }
  });

  it('rolls within the chosen finish', () => {
    const h = host();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter looks by finish' }), {
      target: { value: 'professional' },
    });
    for (let i = 0; i < 4; i++) fireEvent.click(h.mashup());
    expect(h.picks.map((p) => p.finish)).toEqual(Array(4).fill('professional'));
  });
});

describe('the Seasonal toggle', () => {
  afterEach(() => vi.useRealTimers());

  const plain = (settings: LookSettings = UNTOUCHED) =>
    render(
      <LooksCarousel
        settings={settings}
        activeLook={activeLookId(settings)}
        onPickLook={() => {}}
        headingClass=""
      />,
    );
  const toggle = () => screen.getByRole('button', { name: 'Seasonal' });

  it('swaps the everyday looks for the seasonal ones only, the season on now first, with no Mashup card', () => {
    // Mid-October: Halloween leads, then Christmas, New Year and Easter.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15));
    plain();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(cards()).not.toContain(SEASONAL_LOOKS[0]!.label);
    fireEvent.click(toggle());
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'LooksSeasonal');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(cards()).toEqual(seasonalLooksFor(new Date(2026, 9, 15)).map((l) => l.label));
    expect(cards()[0]).toBe('Haunted');
    expect(seasonsShown()[0]).toBe('Halloween');
    expect(screen.queryByRole('button', { name: MASHUP })).toBeNull();
    fireEvent.click(toggle());
    expect(cards()).toEqual(['Mashup', ...TAB_LOOKS.map((l) => l.label)]);
  });

  it('narrows the seasonal looks by finish too', () => {
    plain();
    fireEvent.click(toggle());
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter looks by finish' }), {
      target: { value: 'sketch' },
    });
    const sketch = SEASONAL_LOOKS.filter((l) => l.finish === 'sketch').map((l) => l.label);
    expect(sketch.length).toBeGreaterThan(0);
    expect([...cards()].sort()).toEqual([...sketch].sort());
  });

  it('opens on, with the look selected, when the tab already wears a seasonal look', () => {
    const tab = withLookApplied({ id: 't', name: 'T', elements: [] }, SEASONAL_LOOKS[3]!);
    plain(tab);
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    const selected = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-pressed') === 'true' && b.textContent !== 'Seasonal');
    expect(selected?.textContent).toContain(SEASONAL_LOOKS[3]!.label);
  });
});
