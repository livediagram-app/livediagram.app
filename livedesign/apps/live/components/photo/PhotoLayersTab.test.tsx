// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PhotoLayersTab } from './PhotoLayersTab';
import { photoView } from './photo-view-test-utils';

// docs/specs/031-photo/photo-layers.md "The Layers tab": "Reordering ... works by touch too".
afterEach(() => cleanup());

const grips = () => Array.from(document.querySelectorAll<HTMLElement>('[data-layer-grip]'));

describe('the Layers tab on a touch screen', () => {
  it('gives every row a grip a finger drags without scrolling the list', () => {
    // A finger on the row itself scrolled the list (the system took the pointer), so a row never moved.
    const { view } = photoView();
    render(<PhotoLayersTab photo={view} onOpenAdjust={() => {}} others={() => []} />);
    expect(grips()).toHaveLength(2);
    for (const g of grips()) {
      expect(g.className).toContain('touch-none');
      expect(g.className).toContain('pointer-coarse:flex');
      expect(g.className).toContain('hidden');
      expect(g.closest('li[data-layer-id]')).toBeTruthy();
    }
  });

  it('shows no grip to someone who may not edit', () => {
    const { view } = photoView(undefined, undefined, { canEdit: false });
    render(<PhotoLayersTab photo={view} onOpenAdjust={() => {}} others={() => []} />);
    expect(grips()).toHaveLength(0);
  });
});

// docs/specs/031-photo/photo-tools.md "Accessibility": a plain list of rows holding buttons, never a listbox of
// options (axe nested-interactive); each row's name its own button, the active row's the list's tab stop.
describe('the Layers list for a keyboard and a screen reader', () => {
  const selects = () => Array.from(document.querySelectorAll<HTMLElement>('[data-layer-select]'));

  it('is a list of items, with no option holding a button', () => {
    const { view } = photoView();
    render(<PhotoLayersTab photo={view} onOpenAdjust={() => {}} others={() => []} />);
    const list = screen.getByRole('list', { name: 'Layers' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(list.querySelectorAll(':scope > li[data-layer-id]')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Layer 1, pixel layer, visible, 100%' }),
    ).toBeTruthy();
  });

  it('makes the active row the tab stop, marked current, and the arrows move it', () => {
    const { view, s } = photoView();
    act(() => s.choose('a', 'layer'));
    const { rerender } = render(
      <PhotoLayersTab photo={view} onOpenAdjust={() => {}} others={() => []} />,
    );
    const stop = () => selects().filter((b) => b.tabIndex === 0);
    expect(stop()).toHaveLength(1);
    expect(stop()[0]!.getAttribute('aria-current')).toBe('true');
    expect(stop()[0]!.closest('li')!.dataset.layerId).toBe('a');
    fireEvent.keyDown(stop()[0]!, { key: 'ArrowDown' });
    expect(s.active).toBe('bg');
    rerender(
      <PhotoLayersTab photo={{ ...view, version: 1 }} onOpenAdjust={() => {}} others={() => []} />,
    );
    expect(stop()[0]!.closest('li')!.dataset.layerId).toBe('bg');
  });

  it('makes the first row the tab stop while no layer is active', () => {
    const { view, s } = photoView();
    act(() => s.choose(null));
    render(<PhotoLayersTab photo={view} onOpenAdjust={() => {}} others={() => []} />);
    const stop = selects().filter((b) => b.tabIndex === 0);
    expect(stop).toHaveLength(1);
    expect(stop[0]!.closest('li')!.dataset.layerId).toBe('a');
  });

  it('a press on a row’s name makes its layer active, and a chosen row says so', () => {
    const { view, s } = photoView();
    act(() => s.choose('a', 'layer'));
    const { rerender } = render(
      <PhotoLayersTab photo={view} onOpenAdjust={() => {}} others={() => []} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Background, pixel layer/ }), {
      shiftKey: true,
    });
    expect(s.active).toBe('bg');
    rerender(
      <PhotoLayersTab photo={{ ...view, version: 1 }} onOpenAdjust={() => {}} others={() => []} />,
    );
    expect(
      screen.getByRole('button', { name: 'Layer 1, pixel layer, visible, 100%, chosen' }),
    ).toBeTruthy();
  });

  it('leaves a key pressed outside the list (in a row’s portalled menu) alone', () => {
    const { view, s } = photoView();
    act(() => s.choose('a', 'layer'));
    render(<PhotoLayersTab photo={view} onOpenAdjust={() => {}} others={() => []} />);
    fireEvent.click(screen.getByRole('button', { name: 'Layer 1 actions' }));
    const item = screen.getByRole('menuitem', { name: /Duplicate/ });
    fireEvent.keyDown(item, { key: 'ArrowDown' });
    expect(s.active).toBe('a');
  });
});
