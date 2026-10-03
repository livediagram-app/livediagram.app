// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MenuTreeContext } from './menu-tree';
import { useMenu } from './useMenu';
import type { MenuInitialFocus } from './menu-keys';

function Menu({
  onClose,
  trigger = null,
  initialFocus,
  label,
  children,
}: {
  onClose: () => void;
  trigger?: HTMLElement | null;
  initialFocus?: MenuInitialFocus;
  label?: string;
  children: ReactNode;
}) {
  const { attach, tree, surfaceProps } = useMenu({ onClose, trigger, initialFocus, label });
  return (
    <MenuTreeContext.Provider value={tree}>
      <div ref={attach} {...surfaceProps}>
        {children}
      </div>
    </MenuTreeContext.Provider>
  );
}

// A trigger that opens a menu of three verbs; a button after it to Tab to.
function Harness({
  onPick = () => {},
  initialFocus,
  extra,
}: {
  onPick?: (verb: string) => void;
  initialFocus?: MenuInitialFocus;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const pick = (verb: string) => () => {
    onPick(verb);
    setOpen(false);
  };
  return (
    <>
      <button ref={setTrigger} aria-label="Folder actions" onClick={() => setOpen((o) => !o)}>
        ⋯
      </button>
      {open ? (
        <Menu onClose={() => setOpen(false)} trigger={trigger} initialFocus={initialFocus}>
          <button role="menuitem" tabIndex={-1} onClick={pick('rename')}>
            Rename
          </button>
          <button role="menuitem" tabIndex={-1} aria-disabled="true" onClick={pick('move')}>
            Change Folder
          </button>
          <button role="menuitem" tabIndex={-1} onClick={pick('delete')}>
            Delete
          </button>
          {extra}
        </Menu>
      ) : null}
      <button>After</button>
    </>
  );
}

const open = () => {
  const trigger = screen.getByRole('button', { name: 'Folder actions' });
  trigger.focus();
  fireEvent.click(trigger);
  return screen.getByRole('menu');
};
const key = (k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.activeElement!, { key: k, ...init });
const focused = () => document.activeElement?.textContent;

describe('useMenu', () => {
  it('moves focus to the first item on open and names the menu by its trigger', () => {
    render(<Harness />);
    const menu = open();
    expect(focused()).toBe('Rename');
    expect(menu.getAttribute('aria-label')).toBe('Folder actions');
    expect(menu.getAttribute('data-menu-surface')).toBe('command');
  });

  it('points the trigger at the open menu with aria-controls', () => {
    render(<Harness />);
    const menu = open();
    expect(
      screen.getByRole('button', { name: 'Folder actions' }).getAttribute('aria-controls'),
    ).toBe(menu.id);
  });

  it('walks the items with the arrows, wrapping, and Home / End', () => {
    render(<Harness />);
    open();
    key('ArrowDown');
    expect(focused()).toBe('Change Folder');
    key('ArrowDown');
    key('ArrowDown');
    expect(focused()).toBe('Rename');
    key('ArrowUp');
    expect(focused()).toBe('Delete');
    key('Home');
    expect(focused()).toBe('Rename');
    key('End');
    expect(focused()).toBe('Delete');
  });

  it('finds an item by its first letters', () => {
    render(<Harness />);
    open();
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    key('d');
    expect(focused()).toBe('Delete');
    key('c');
    // 'dc' within the window matches nothing: focus stays.
    expect(focused()).toBe('Delete');
    now.mockReturnValue(2000);
    key('c');
    expect(focused()).toBe('Change Folder');
    now.mockRestore();
  });

  it('activates with Enter and Space, and returns focus to the trigger', () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    open();
    key('Enter');
    expect(onPick).toHaveBeenLastCalledWith('rename');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Folder actions' }));
    open();
    key('End');
    key(' ');
    expect(onPick).toHaveBeenLastCalledWith('delete');
  });

  it('never activates a disabled item', () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    open();
    key('ArrowDown');
    key('Enter');
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<Harness />);
    open();
    key('Escape');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Folder actions' }));
  });

  it('closes on Tab and moves to the control after the trigger', () => {
    render(<Harness />);
    open();
    key('Tab');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(focused()).toBe('After');
  });

  it('stops the keys it handles from reaching listeners outside the menu', () => {
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    render(<Harness />);
    open();
    key('ArrowDown');
    key('x', { ctrlKey: true });
    document.removeEventListener('keydown', outside);
    expect(outside).toHaveBeenCalledTimes(1);
    expect(outside.mock.calls[0]![0]).toHaveProperty('ctrlKey', true);
  });

  it('opens on the last item, or without taking focus, when asked', () => {
    const { unmount } = render(<Harness initialFocus="last" />);
    open();
    expect(focused()).toBe('Delete');
    unmount();
    render(<Harness initialFocus="none" />);
    open();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Folder actions' }));
  });

  it('lands on the checked entry of a one-of-a-set menu', () => {
    render(
      <Menu onClose={() => {}}>
        <button role="menuitemradio" aria-checked="false" tabIndex={-1}>
          Diagram
        </button>
        <button role="menuitemradio" aria-checked="true" tabIndex={-1}>
          Draw
        </button>
      </Menu>,
    );
    expect(focused()).toBe('Draw');
  });

  it('is named by a header it owns before its trigger', () => {
    render(
      <Menu onClose={() => {}} label={undefined}>
        <div data-menu-label="" id="h" aria-hidden="true">
          Retros
        </div>
        <button role="menuitem" tabIndex={-1}>
          Rename
        </button>
      </Menu>,
    );
    expect(screen.getByRole('menu').getAttribute('aria-labelledby')).toBe('h');
  });

  it('leaves the caret in a text edit that holds focus on open', () => {
    function Editing() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <input aria-label="Label" onChange={() => setOpen(true)} />
          {open ? (
            <Menu onClose={() => {}}>
              <button role="menuitem" tabIndex={-1}>
                Bold
              </button>
            </Menu>
          ) : null}
        </>
      );
    }
    render(<Editing />);
    const input = screen.getByRole('textbox', { name: 'Label' });
    input.focus();
    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(document.activeElement).toBe(input);
  });

  it('warns when it opens with nothing to focus', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Menu onClose={() => {}}>{null}</Menu>);
    expect(warn).toHaveBeenCalledWith('[menu] opened with no items', expect.anything());
    warn.mockRestore();
  });
});

describe('useMenu submenus', () => {
  function Tree({ onRootClose = () => {} }: { onRootClose?: () => void }) {
    const [rootOpen, setRootOpen] = useState(true);
    const [subOpen, setSubOpen] = useState(false);
    return (
      <>
        <button>Before</button>
        {rootOpen ? (
          <Menu
            onClose={() => {
              onRootClose();
              setRootOpen(false);
            }}
          >
            <button role="menuitem" tabIndex={-1}>
              Rename
            </button>
            <button
              role="menuitem"
              tabIndex={-1}
              aria-haspopup="menu"
              aria-expanded={subOpen}
              aria-controls={subOpen ? 'sub' : undefined}
              onClick={() => setSubOpen((o) => !o)}
            >
              Use as default for
            </button>
            {subOpen ? <SubMenu onClose={() => setSubOpen(false)} /> : null}
          </Menu>
        ) : null}
        <button>After</button>
      </>
    );
  }
  function SubMenu({ onClose }: { onClose: () => void }) {
    const { attach, surfaceProps } = useMenu({ onClose });
    return (
      <div ref={attach} {...surfaceProps} id="sub">
        <button role="menuitemcheckbox" aria-checked="false" tabIndex={-1}>
          Diagrams
        </button>
        <button role="menuitemcheckbox" aria-checked="true" tabIndex={-1}>
          Whiteboards
        </button>
      </div>
    );
  }

  it('opens with Right Arrow, focuses inside, and Left Arrow comes back to the trigger', () => {
    render(<Tree />);
    key('ArrowDown');
    expect(focused()).toBe('Use as default for');
    key('ArrowRight');
    expect(focused()).toBe('Diagrams');
    expect(document.getElementById('sub')?.getAttribute('data-menu-parent')).toBe(
      screen.getAllByRole('menu')[0]!.id,
    );
    key('ArrowLeft');
    expect(document.getElementById('sub')).toBeNull();
    expect(focused()).toBe('Use as default for');
  });

  it('closes only the submenu on Escape', () => {
    render(<Tree />);
    key('ArrowDown');
    key('Enter');
    expect(focused()).toBe('Diagrams');
    key('Escape');
    expect(document.getElementById('sub')).toBeNull();
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(focused()).toBe('Use as default for');
  });

  it('closes the whole tree on Tab', () => {
    const onRootClose = vi.fn();
    render(<Tree onRootClose={onRootClose} />);
    key('ArrowDown');
    key('ArrowRight');
    key('Tab');
    expect(onRootClose).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Enter on an open submenu trigger goes into it rather than closing it', () => {
    render(<Tree />);
    key('ArrowDown');
    key('ArrowRight');
    key('ArrowLeft');
    key('ArrowRight');
    (screen.getByText('Use as default for') as HTMLElement).focus();
    key('Enter');
    expect(focused()).toBe('Diagrams');
  });
});
