// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSection, SlotFillPicker } from './SlotFillPicker';

// docs/specs/026-plan/plan-tabs.md "Filling a slot": Add to Slot opens on its categories, drills into one, and goes
// back by its breadcrumb, Escape or Backspace before it closes.
vi.mock('@/hooks/plan/plan-tab-list-store', () => ({ usePlanTabList: () => [] }));
afterEach(cleanup);

function show(size: { width: number; height: number } | null = { width: 800, height: 600 }) {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(<SlotFillPicker anchor={anchor} size={size} onPick={onPick} onClose={onClose} />);
  return { onPick, onClose };
}
const category = (name: RegExp) => screen.getByRole('button', { name });
const key = (k: string) =>
  act(() => {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true }),
    );
  });

describe('Add to Slot’s categories', () => {
  it('opens on the categories that fit, each with its count, and the too-big line', () => {
    show({ width: 300, height: 160 });
    const panel = screen.getByRole('dialog', { name: 'Add to Slot' });
    expect([...panel.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Metrics, 10 choices',
      'From a Sheet, 3 choices',
      'Utilities, 6 choices',
    ]);
    // Each says what is inside, in full.
    expect(panel.textContent).toContain('Figures and charts read live from a sheet.');
    expect(screen.getByText(/need a bigger slot/)).toBeTruthy();
    expect(document.activeElement).toBe(category(/^Metrics/));
  });

  it('drills into one under the breadcrumb, focusing its first tile, and picks from there', () => {
    const { onPick } = show();
    fireEvent.click(category(/^From a Sheet/));
    expect(screen.getByRole('button', { name: /Add to Slot/ }).textContent).toContain(
      'From a Sheet',
    );
    expect(screen.queryByText(/need a bigger slot|Only what looks good/)).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add Sheet Figure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Sheet Chart' }));
    expect(onPick).toHaveBeenCalledWith({ kind: 'sheet-chart' });
  });

  it('goes back by the breadcrumb, Escape or Backspace, focusing the category, then closes on Escape', () => {
    const { onClose } = show();
    fireEvent.click(category(/^Metrics/));
    fireEvent.click(screen.getByRole('button', { name: /Add to Slot/ }));
    expect(document.activeElement).toBe(category(/^Metrics/));
    fireEvent.click(category(/^Utilities/));
    key('Escape');
    expect(document.activeElement).toBe(category(/^Utilities/));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(category(/^Utilities/));
    key('Backspace');
    expect(document.activeElement).toBe(category(/^Utilities/));
    key('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cascades the categories in on opening, then slides each level in from where it lies', () => {
    show();
    const card = () => category(/^Metrics/);
    expect(card().className).toContain('animate-card-rise');
    fireEvent.click(card());
    const level = () => screen.getByRole('region', { name: 'Metrics' }).parentElement!;
    expect(level().className).toContain('animate-tip-next');
    key('Escape');
    expect(card().parentElement!.parentElement!.className).toContain('animate-tip-prev');
    // Back, the categories do not cascade again.
    expect(card().className).not.toContain('animate-card-rise');
  });

  it('opens a lone category at once, with nowhere to go back to', () => {
    const a = { title: 'Utilities' };
    const b = { title: 'Metrics' };
    expect(openSection([a], null)).toEqual({ open: a, only: true });
    expect(openSection([a, b], null)).toEqual({ open: null, only: false });
    expect(openSection([a, b], 'Metrics')).toEqual({ open: b, only: false });
    expect(openSection([a, b], 'Gone')).toEqual({ open: null, only: false });
  });
});
