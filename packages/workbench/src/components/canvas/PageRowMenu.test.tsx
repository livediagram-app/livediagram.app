// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS } from '../../hooks/ui/useLongPress';
import {
  LIFT_CLICK_MS,
  PageRowMenu,
  PageRowMenuButton,
  PageRowStack,
  pageRowModel,
  usePageRowMenu,
  type PageRowModel,
} from './PageRowMenu';

// A Contents row's page actions (each product's docs/specs/007-editor/pages-mode.md "Contents",
// "A page's actions").
const labels = (model: PageRowModel) => model.groups.map((g) => g.map((a) => a.label));

describe('pageRowModel', () => {
  it('groups every verb a page can take, Delete apart', () => {
    const remove = vi.fn();
    const model = pageRowModel({
      settings: vi.fn(),
      extra: [{ key: 'x', label: 'Hide in Slides', icon: null, run: vi.fn() }],
      duplicate: vi.fn(),
      moveUp: vi.fn(),
      moveDown: vi.fn(),
      locked: false,
      toggleLock: vi.fn(),
      remove,
    });
    expect(labels(model)).toEqual([
      ['Page Settings'],
      ['Hide in Slides'],
      ['Duplicate', 'Move Up', 'Move Down', 'Lock'],
    ]);
    expect(model.remove).toBe(remove);
  });

  it('leaves out what the page cannot take, and offers Unlock on a locked page', () => {
    const model = pageRowModel({ locked: true, toggleLock: vi.fn() });
    expect(labels(model)).toEqual([['Unlock']]);
    expect(model.remove).toBeUndefined();
  });
});

function List({
  models,
  stack = false,
  go = () => {},
}: {
  models: Record<string, PageRowModel>;
  stack?: boolean;
  go?: (id: string) => void;
}) {
  const menu = usePageRowMenu();
  return (
    <>
      {Object.entries(models).map(([id, model]) => (
        <div key={id} data-testid={`row-${id}`} {...menu.rowProps(id)} onClick={() => go(id)}>
          <span data-contents-grip="" data-testid={`grip-${id}`} />
          {stack ? (
            <PageRowStack
              id={id}
              name={`Page ${id}`}
              menu={menu}
              grip={<span data-testid="grip" />}
              shown={false}
              {...(model.remove ? { remove: model.remove } : {})}
            />
          ) : (
            <PageRowMenuButton id={id} name={`Page ${id}`} menu={menu} reveal />
          )}
        </div>
      ))}
      {menu.openId ? (
        <PageRowMenu
          title={`Page ${menu.openId}`}
          model={models[menu.openId]!}
          anchor={menu.anchor}
          onClose={menu.close}
        />
      ) : null}
    </>
  );
}

const model = (over: Partial<Parameters<typeof pageRowModel>[0]> = {}) => {
  const verbs = {
    duplicate: vi.fn(),
    toggleLock: vi.fn(),
    remove: vi.fn(),
    locked: false,
    ...over,
  };
  return { verbs, model: pageRowModel(verbs) };
};

describe('PageRowMenu', () => {
  it('opens one menu, for the row pressed, and runs a verb then closes', () => {
    const a = model();
    const b = model();
    render(<List models={{ a: a.model, b: b.model }} />);
    fireEvent.click(screen.getByRole('button', { name: 'More Actions for Page b' }));
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(screen.getByText('Page b')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'More Actions for Page b' }).getAttribute('aria-expanded'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(b.verbs.duplicate).toHaveBeenCalledOnce();
    expect(a.verbs.duplicate).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('ends in Delete, after its own separator', () => {
    const a = model();
    render(<List models={{ a: a.model }} />);
    fireEvent.click(screen.getByRole('button', { name: 'More Actions for Page a' }));
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items.at(-1)).toBe('Delete');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(a.verbs.remove).toHaveBeenCalledOnce();
  });

  it('toggles shut from its ⋯, and opens from the arrow keys', () => {
    render(<List models={{ a: model().model }} />);
    const trigger = screen.getByRole('button', { name: 'More Actions for Page a' });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('opens on a right-click on the row', () => {
    render(<List models={{ a: model().model }} />);
    fireEvent.contextMenu(screen.getByTestId('row-a'));
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it("opens on a finger's long press, and swallows the click its lift makes", () => {
    vi.useFakeTimers();
    try {
      const go = vi.fn();
      render(<List models={{ a: model().model }} go={go} />);
      const row = screen.getByTestId('row-a');
      fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 5, clientY: 5 });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS);
      });
      expect(screen.getByRole('menu')).toBeTruthy();
      // The lift's click, wherever it lands (here the menu's first item), is swallowed once.
      fireEvent.pointerUp(window);
      fireEvent.click(screen.getAllByRole('menuitem')[0]!);
      expect(screen.getByRole('menu')).toBeTruthy();
      fireEvent.click(row);
      expect(go).toHaveBeenCalledWith('a');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets clicks through once the lift has passed without one', () => {
    vi.useFakeTimers();
    try {
      const go = vi.fn();
      render(<List models={{ a: model().model }} go={go} />);
      const row = screen.getByTestId('row-a');
      fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 5, clientY: 5 });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS);
      });
      fireEvent.pointerUp(window);
      act(() => {
        vi.advanceTimersByTime(LIFT_CLICK_MS);
      });
      fireEvent.click(row);
      expect(go).toHaveBeenCalledWith('a');
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens nothing for a finger held on the row's grip, which is starting a drag", () => {
    vi.useFakeTimers();
    try {
      render(<List models={{ a: model().model }} />);
      fireEvent.pointerDown(screen.getByTestId('grip-a'), {
        pointerType: 'touch',
        clientX: 5,
        clientY: 5,
      });
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS * 2);
      });
      expect(screen.queryByRole('menu')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a long press that ends before its menu could open', () => {
    vi.useFakeTimers();
    try {
      render(<List models={{ a: model().model }} />);
      const row = screen.getByTestId('row-a');
      fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 5, clientY: 5 });
      fireEvent.pointerUp(window);
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS);
      });
      expect(screen.queryByRole('menu')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('PageRowStack', () => {
  it('stacks the grip, Delete and ⋯, Delete running at once', () => {
    const a = model();
    render(<List models={{ a: a.model }} stack />);
    const stack = document.querySelector('[data-page-row-stack]')!;
    expect(stack.firstElementChild?.getAttribute('data-testid')).toBe('grip');
    expect(stack.className).toContain('opacity-0');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Page a' }));
    expect(a.verbs.remove).toHaveBeenCalledOnce();
    // Its ⋯ open keeps the stack shown.
    fireEvent.click(screen.getByRole('button', { name: 'More Actions for Page a' }));
    expect(stack.className).not.toContain('opacity-0');
  });

  it('offers no Delete on a page that cannot be deleted', () => {
    render(<List models={{ a: pageRowModel({ locked: true, toggleLock: vi.fn() }) }} stack />);
    expect(screen.queryByRole('button', { name: 'Delete Page a' })).toBeNull();
    expect(screen.getByRole('button', { name: 'More Actions for Page a' })).toBeTruthy();
  });
});
