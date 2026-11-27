// A team's Library tab chips (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"): each app's logo
// and name with its count, one row that never wraps, and a pick writes the lens's Opens in.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseLens, type LensContext } from '../../lens';
import { KindChips, SortMenu } from './LibraryToolbar';

const context: LensContext = { view: 'scoped', teams: [], templates: [], modes: [] };

afterEach(cleanup);

function renderChips(lens = '', onLens = vi.fn()) {
  render(
    <KindChips
      counts={[
        { kind: 'canvas', count: 2 },
        { kind: 'plan', count: 3 },
      ]}
      total={5}
      lens={lens}
      parsed={parseLens(lens, context)}
      onLens={onLens}
      lensContext={context}
    />,
  );
  return onLens;
}

describe('the Library kind chips', () => {
  it('names each app with its logo and count, All first, in one row that scrolls', () => {
    renderChips();
    const group = screen.getByRole('group', { name: 'Show' });
    expect(group.className).toContain('overflow-x-auto');
    expect(group.className).not.toContain('flex-wrap');
    // The logo's own words are hidden here, so each chip is named once: the app and its count.
    expect(screen.getByRole('button', { name: /^All\s*5$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^livediagram\s*2$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^liveplanner\s*3$/ })).toBeTruthy();
    const plan = screen.getByRole('button', { name: /liveplanner/ });
    expect(plan.querySelector('[data-app-mark="liveplanner"]')).not.toBeNull();
  });

  it('a pick sets Opens in, and picking it again clears it', () => {
    const onLens = renderChips();
    fireEvent.click(screen.getByRole('button', { name: /liveplanner/ }));
    expect(onLens).toHaveBeenLastCalledWith(expect.stringContaining('opens-in:plan'));
    cleanup();
    const again = renderChips('opens-in:plan');
    const on = screen.getByRole('button', { name: /liveplanner/ });
    expect(on.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(on);
    expect(again).toHaveBeenLastCalledWith('');
  });

  it('fades the far edge only while chips are past it', () => {
    const widths = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(700);
    const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    renderChips();
    const group = screen.getByRole('group', { name: 'Show' });
    // The end fades, the start (at rest) doesn't.
    expect(group.style.maskImage.match(/transparent/g)).toHaveLength(1);
    expect(group.style.maskImage.trimEnd().endsWith('transparent)')).toBe(true);
    widths.mockReturnValue(400);
    fireEvent.scroll(group);
    expect(group.style.maskImage).toBe('');
    widths.mockRestore();
    client.mockRestore();
  });
});

describe('Sort on a phone (Work Tracker 1516)', () => {
  it('is the icon alone, with a dot only while an order other than the default is on', () => {
    const onSort = vi.fn();
    const { rerender } = render(<SortMenu compact sort="updated" onSort={onSort} />);
    const button = screen.getByRole('button', { name: 'Sort: Last Changed' });
    expect(button.textContent).toBe('');
    expect(button.querySelector('[data-sort-dot]')).toBeNull();
    rerender(<SortMenu compact sort="name" onSort={onSort} />);
    expect(
      screen.getByRole('button', { name: 'Sort: Name' }).querySelector('[data-sort-dot]'),
    ).not.toBeNull();
  });

  it('opens a sheet of the orders, the current one ticked, and a pick sorts', async () => {
    const onSort = vi.fn();
    render(<SortMenu compact sort="updated" onSort={onSort} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort: Last Changed' }));
    const sheet = await screen.findByRole('dialog', { name: 'Sort by' });
    const last = within(sheet).getByRole('radio', { name: 'Last Changed' });
    expect(last.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Name' }));
    expect(onSort).toHaveBeenCalledWith('name');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('picking the order already on closes the sheet and changes nothing', async () => {
    const onSort = vi.fn();
    render(<SortMenu compact sort="name" onSort={onSort} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort: Name' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Name' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSort).not.toHaveBeenCalled();
  });
});
