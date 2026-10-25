// @vitest-environment jsdom

// docs/specs/007-editor/pages-mode.md "The layout gallery", "An empty page offers its layouts":
// the gallery's chips, search, Surprise Me and tiles, and Choose a Layout's dialog.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newWireframePage, pageDeviceClass } from '@livedesign/design';
import { layoutCatalogueFor } from '@livedesign/templates';
import { EmptyPageInvite } from '@liveworkspace/workbench/components/canvas/EmptyPageInvite';
import { LayoutGalleryDialog } from '../LayoutGalleryDialog';
import { LayoutGallery } from './LayoutGallery';

afterEach(() => cleanup());

const [screenPage] = layOutPages([newWireframePage('s')]);
// A phone's layouts: what the gallery offers a wireframe page on one.
const LAYOUTS = layoutCatalogueFor('wireframe', pageDeviceClass(screenPage!)).layouts;
const tiles = () => document.querySelectorAll('[data-layout-tile]');
const chip = (name: RegExp) =>
  within(screen.getByRole('group', { name: 'Layout categories' })).getByRole('button', { name });

describe('LayoutGallery', () => {
  it('shows every layout under All, in a section per category', () => {
    render(<LayoutGallery page={screenPage!} onApply={vi.fn()} onPreview={vi.fn()} />);
    expect(tiles()).toHaveLength(LAYOUTS.length);
    expect(chip(/^All/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: 'Shop' })).not.toBeNull();
  });

  it('narrows to one category by its chip, and searches across them', () => {
    render(<LayoutGallery page={screenPage!} onApply={vi.fn()} onPreview={vi.fn()} />);
    fireEvent.click(chip(/^Shop/));
    expect(tiles()).toHaveLength(
      LAYOUTS.filter((l: { category: string }) => l.category === 'wf-shop').length,
    );
    fireEvent.click(chip(/^All/));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search layouts' }), {
      target: { value: 'boarding pass' },
    });
    expect([...tiles()].map((t) => t.getAttribute('data-layout-tile'))).toEqual([
      'wf-boarding-pass',
    ]);
  });

  it('says so when nothing matches, and clears back to every layout', () => {
    render(<LayoutGallery page={screenPage!} onApply={vi.fn()} onPreview={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search layouts' }), {
      target: { value: 'zzzz' },
    });
    expect(tiles()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Surprise Me/ })).toHaveProperty('disabled', true);
    // The empty state's own Clear Search (the search box carries one too).
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear Search' }).at(-1)!);
    expect(tiles()).toHaveLength(LAYOUTS.length);
  });

  it('places a pressed tile, and previews one under the pointer', () => {
    const onApply = vi.fn();
    const onPreview = vi.fn();
    render(<LayoutGallery page={screenPage!} onApply={onApply} onPreview={onPreview} />);
    const tile = document.querySelector('[data-layout-tile="wf-checkout"]')!;
    fireEvent.pointerEnter(tile);
    expect(onPreview).toHaveBeenLastCalledWith('wf-checkout');
    fireEvent.click(tile);
    expect(onApply).toHaveBeenCalledWith('wf-checkout');
  });

  it('lands Surprise Me on a layout shown, through its own handler where given', () => {
    const onApply = vi.fn();
    const onSurprise = vi.fn();
    render(
      <LayoutGallery
        page={screenPage!}
        onApply={onApply}
        onSurprise={onSurprise}
        onPreview={vi.fn()}
      />,
    );
    fireEvent.click(chip(/^Shop/));
    fireEvent.click(screen.getByRole('button', { name: /Surprise Me/ }));
    expect(onApply).not.toHaveBeenCalled();
    const picked = onSurprise.mock.calls[0]![0];
    expect(LAYOUTS.find((l) => l.id === picked)!.category).toBe('wf-shop');
  });
});

describe('Choose a Layout', () => {
  it('opens the gallery on its own', () => {
    const onOpen = vi.fn();
    render(<EmptyPageInvite pageId="s" zoom={0.5} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a Layout' }));
    expect(onOpen).toHaveBeenCalled();
  });

  it('places a layout from the dialog and closes it', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<LayoutGalleryDialog page={screenPage!} onApply={onApply} onClose={onClose} />);
    expect(screen.getByRole('heading', { name: 'Start From a Layout' })).not.toBeNull();
    fireEvent.click(document.querySelector('[data-layout-tile="wf-sign-in"]')!);
    expect(onApply).toHaveBeenCalledWith('wf-sign-in');
    expect(onClose).toHaveBeenCalled();
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
    const layout = LAYOUTS[0]!;
    const onPreview = vi.fn();
    const { container } = render(
      <LayoutTile
        layout={layout}
        page={screenPage!}
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
