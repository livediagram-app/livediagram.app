// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { slashModel } from '@/lib/article/slash-menu-model';
import { SLASH_ITEMS } from '@/lib/article/article-slash-items';
import { SLASH_MENU_ID, SLASH_SHEET_QUERY, SlashMenu, slashOptionId } from './SlashMenu';

// docs/specs/030-knowledgebase/page-surface.md "The slash menu": its sections and entries, the typed letters bold,
// the preview, the empty state, the pointer, and the phone's sheet.
const AT = { left: 300, top: 200, bottom: 220 };

function matchMediaFor(sheet: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: sheet && query === SLASH_SHEET_QUERY,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function menu(query = '', opts: { recent?: string[]; index?: number; sheet?: boolean } = {}) {
  matchMediaFor(!!opts.sheet);
  const onPick = vi.fn();
  const onHover = vi.fn();
  const view = render(
    <SlashMenu
      at={AT}
      model={slashModel(query, opts.recent)}
      index={opts.index ?? 0}
      query={query}
      onPick={onPick}
      onHover={onHover}
      look={{ '--article-heading-font': 'Georgia' }}
    />,
  );
  return { onPick, onHover, ...view };
}

describe('SlashMenu', () => {
  it('is a listbox "Insert a block" of named groups, each entry an option with its line', () => {
    menu();
    const list = screen.getByRole('listbox', { name: 'Insert a block' });
    expect(list.id).toBe(SLASH_MENU_ID);
    expect(
      within(list)
        .getAllByRole('group')
        .map((g) => g.getAttribute('aria-label')),
    ).toEqual(['Text', 'Lists', 'Media and Embeds', 'Knowledge', 'Layout']);
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(SLASH_ITEMS.length);
    expect(options[0]!.id).toBe(slashOptionId(0));
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('option', { name: 'Heading 1, A big section heading' })).toBeTruthy();
  });

  it('heads with Recent while nothing is typed', () => {
    menu('', { recent: ['table'] });
    const groups = screen.getAllByRole('group');
    expect(groups[0]!.getAttribute('aria-label')).toBe('Recent');
    expect(within(groups[0]!).getByRole('option').textContent).toContain('Table');
  });

  it('draws the typed letters of each name bold', () => {
    menu('hd2');
    const first = screen.getAllByRole('option')[0]!;
    expect([...first.querySelectorAll('b')].map((b) => b.textContent)).toEqual(['H', 'd', '2']);
  });

  it('previews the highlighted block with its shortcut, in the writing’s look', () => {
    const { container } = menu('', { index: 1 });
    void container;
    const preview = document.querySelector('[data-slash-preview]') as HTMLElement;
    expect(preview.dataset.slashPreview).toBe('h1');
    expect(preview.textContent).toContain('Getting Started');
    expect(preview.textContent).toContain('then Space');
    const box = document.querySelector('[data-slash-menu]') as HTMLElement;
    expect(box.dataset.slashMenu).toBe('popover');
    expect(box.style.getPropertyValue('--article-heading-font')).toBe('Georgia');
    // The keys, said at the list's foot.
    expect(box.textContent).toContain('Next Group');
  });

  it('draws a preview for every entry', () => {
    for (let i = 0; i < SLASH_ITEMS.length; i++) {
      const { unmount } = menu('', { index: i });
      const preview = document.querySelector('[data-slash-preview]') as HTMLElement;
      expect(preview.dataset.slashPreview).toBe(SLASH_ITEMS[i]!.id);
      expect(preview.firstElementChild!.childElementCount).toBeGreaterThan(0);
      unmount();
    }
  });

  it('says no blocks match, with what was typed', () => {
    menu('qqqq');
    expect(screen.getByRole('status').textContent).toContain('qqqq');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(document.querySelector('[data-slash-preview]')).toBeNull();
  });

  it('highlights an entry the pointer rests on, chooses one it presses, and keeps the focus in the writing', () => {
    const { onPick, onHover } = menu();
    const table = screen.getByRole('option', { name: /^Table, Rows/ });
    fireEvent.pointerEnter(table);
    expect(onHover).toHaveBeenCalledWith(Number(table.dataset.slashIndex));
    fireEvent.click(table);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'table' }));
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    table.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });

  it('is a sheet on a phone: no preview, entries 44 px tall', () => {
    menu('', { sheet: true });
    const box = document.querySelector('[data-slash-menu]') as HTMLElement;
    expect(box.dataset.slashMenu).toBe('sheet');
    expect(box.className).toContain('animate-sheet-up');
    expect(document.querySelector('[data-slash-preview]')).toBeNull();
    expect(screen.getAllByRole('option')[0]!.className).toContain('min-h-11');
  });

  it('renders the whole menu within a small budget', () => {
    matchMediaFor(false);
    const model = slashModel('');
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 20; i++) {
        const { unmount } = render(
          <SlashMenu at={AT} model={model} index={i} onPick={() => {}} onHover={() => {}} />,
        );
        unmount();
      }
    });
    expect(ms).toBeLessThan(cpuBudgetMs(1500));
  });
});
