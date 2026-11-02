// @vitest-environment jsdom

// docs/specs/007-editor/pages-mode.md "The layout gallery", "An empty page offers its layouts":
// the gallery's chips, search, Surprise Me and tiles, and Choose a Layout's dialog.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newSlidePage } from '@livedocuments/document';
import { SLIDE_LAYOUTS } from '@livedocuments/templates';
import { LayoutGallery } from './LayoutGallery';

afterEach(() => cleanup());

const [slide] = layOutPages([newSlidePage('s', 'slide')]);
const tiles = () => document.querySelectorAll('[data-layout-tile]');
const chip = (name: RegExp) =>
  within(screen.getByRole('group', { name: 'Layout categories' })).getByRole('button', { name });

describe('LayoutGallery', () => {
  it('shows every layout under All, in a section per category', () => {
    render(<LayoutGallery page={slide!} onApply={vi.fn()} onPreview={vi.fn()} />);
    expect(tiles()).toHaveLength(SLIDE_LAYOUTS.length);
    expect(chip(/^All/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: 'Pictures' })).not.toBeNull();
  });

  it('narrows to one category by its chip, and searches across them', () => {
    render(<LayoutGallery page={slide!} onApply={vi.fn()} onPreview={vi.fn()} />);
    fireEvent.click(chip(/^Pictures/));
    expect(tiles()).toHaveLength(
      SLIDE_LAYOUTS.filter((l) => l.category === 'slide-pictures').length,
    );
    fireEvent.click(chip(/^All/));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search layouts' }), {
      target: { value: 'hero' },
    });
    expect([...tiles()].map((t) => t.getAttribute('data-layout-tile'))).toEqual([
      'slide-hero-image',
    ]);
  });

  it('says so when nothing matches, and clears back to every layout', () => {
    render(<LayoutGallery page={slide!} onApply={vi.fn()} onPreview={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search layouts' }), {
      target: { value: 'zzzz' },
    });
    expect(tiles()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Surprise Me/ })).toHaveProperty('disabled', true);
    // The empty state's own Clear Search (the search box carries one too).
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear Search' }).at(-1)!);
    expect(tiles()).toHaveLength(SLIDE_LAYOUTS.length);
  });

  it('places a pressed tile, and previews one under the pointer', () => {
    const onApply = vi.fn();
    const onPreview = vi.fn();
    render(<LayoutGallery page={slide!} onApply={onApply} onPreview={onPreview} />);
    const tile = document.querySelector('[data-layout-tile="slide-split-image-right"]')!;
    fireEvent.pointerEnter(tile);
    expect(onPreview).toHaveBeenLastCalledWith('slide-split-image-right');
    fireEvent.click(tile);
    expect(onApply).toHaveBeenCalledWith('slide-split-image-right');
  });

  it('lands Surprise Me on a layout shown, through its own handler where given', () => {
    const onApply = vi.fn();
    const onSurprise = vi.fn();
    render(
      <LayoutGallery page={slide!} onApply={onApply} onSurprise={onSurprise} onPreview={vi.fn()} />,
    );
    fireEvent.click(chip(/^Pictures/));
    fireEvent.click(screen.getByRole('button', { name: /Surprise Me/ }));
    expect(onApply).not.toHaveBeenCalled();
    const picked = onSurprise.mock.calls[0]![0];
    expect(SLIDE_LAYOUTS.find((l) => l.id === picked)!.category).toBe('slide-pictures');
  });
});

describe('LayoutTile', () => {
  it('draws its preview only once it comes near view', async () => {
    const { act } = await import('@testing-library/react');
    const seen: ((hit: boolean) => void)[] = [];
    const IO = class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        seen.push((hit) => cb([{ isIntersecting: hit }]));
      }
      observe() {}
      disconnect() {}
    };
    const prior = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = IO as unknown as typeof IntersectionObserver;
    const { LayoutTile } = await import('./LayoutTile');
    const layout = SLIDE_LAYOUTS[0]!;
    const onPreview = vi.fn();
    const { container } = render(
      <LayoutTile
        layout={layout}
        page={slide!}
        width={160}
        described
        scrollRoot={{ current: null }}
        onPick={vi.fn()}
        onPreview={onPreview}
      />,
    );
    expect(container.querySelector('svg')).toBeNull();
    act(() => seen[0]!(false));
    expect(container.querySelector('svg')).toBeNull();
    act(() => seen[0]!(true));
    expect(container.querySelector('svg')).not.toBeNull();
    fireEvent.focus(container.querySelector('[data-layout-tile]')!);
    expect(onPreview).toHaveBeenCalledWith(layout.id);
    expect(screen.getByText(layout.description)).not.toBeNull();
    globalThis.IntersectionObserver = prior;
  });
});
