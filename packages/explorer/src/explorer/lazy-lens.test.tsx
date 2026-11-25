// The lens's chips load from their own chunk (lazy-lens.tsx): until the code is in, the row's place is kept, empty
// and hidden from assistive tech; once in, the chips draw there, and the filtered list's empty card is in with them.
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ParsedLens } from '../lens';

const parsed = { lens: { text: [], filters: {} }, terms: [], issues: [] } as unknown as ParsedLens;

afterEach(() => {
  vi.doUnmock('./Lens');
  vi.resetModules();
});

describe('LensBarPlaceholder', () => {
  it('keeps the chip row’s height and nothing to read or focus', async () => {
    const { LensBarPlaceholder } = await import('./lazy-lens');
    const { container } = render(<LensBarPlaceholder />);
    const row = container.querySelector('[data-lens-placeholder]')!;
    expect(row.getAttribute('aria-hidden')).toBe('true');
    expect(row.className).toBe('mb-3');
    expect(row.firstElementChild!.className).toBe('h-10');
    expect(row.querySelector('button, [tabindex]')).toBeNull();
  });
});

describe('the lazy lens', () => {
  it('draws the placeholder until the chips’ code lands, then the chips, with the empty card loaded too', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.resetModules();
    vi.doMock('./Lens', async () => {
      await gate;
      return {
        LensBar: () => <div data-testid="chips" />,
        FilteredEmpty: () => <p data-testid="filtered-empty" />,
      };
    });
    const { LensBar, FilteredEmpty } = await import('./lazy-lens');

    render(<LensBar parsed={parsed} showIssues />);
    expect(document.querySelector('[data-lens-placeholder]')).not.toBeNull();
    expect(screen.queryByTestId('chips')).toBeNull();

    await act(async () => {
      release();
      await gate;
    });
    expect(await screen.findByTestId('chips')).toBeTruthy();
    expect(document.querySelector('[data-lens-placeholder]')).toBeNull();

    // Fetched with the chips (nothing else asked for it): drawn in the commit that shows it, no Suspense in between.
    render(<FilteredEmpty issues={[]} words={{} as never} onClear={() => {}} />);
    expect(screen.getByTestId('filtered-empty')).toBeTruthy();
  });
});
