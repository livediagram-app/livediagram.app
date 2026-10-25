// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MenuTreeContext } from './menu-tree';
import { useControlMenu } from './useControlMenu';

function Panel({
  label,
  onClose,
  focusOnOpen,
  children,
}: {
  label: string;
  onClose: () => void;
  focusOnOpen?: boolean;
  children?: ReactNode;
}) {
  const { attach, tree, surfaceProps } = useControlMenu({ label, onClose, focusOnOpen });
  return (
    <MenuTreeContext.Provider value={tree}>
      <div ref={attach} {...surfaceProps}>
        <button>Layer</button>
        <input aria-label="Opacity" type="range" />
        {children}
      </div>
    </MenuTreeContext.Provider>
  );
}

function Harness({ focusOnOpen }: { focusOnOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open menu</button>
      {open ? (
        <Panel label="Element menu" onClose={() => setOpen(false)} focusOnOpen={focusOnOpen}>
          <button aria-haspopup="dialog" aria-expanded={sub} onClick={() => setSub(true)}>
            Style
          </button>
          {sub ? <Panel label="Style" onClose={() => setSub(false)} focusOnOpen /> : null}
        </Panel>
      ) : null}
    </>
  );
}

const opener = () => screen.getByRole('button', { name: 'Open menu' });

describe('useControlMenu', () => {
  it('is a named non-modal dialog', () => {
    render(<Harness focusOnOpen={false} />);
    fireEvent.click(opener());
    const panel = screen.getByRole('dialog', { name: 'Element menu' });
    expect(panel.getAttribute('data-menu-surface')).toBe('control');
    expect(panel.hasAttribute('aria-modal')).toBe(false);
  });

  it('takes focus to its first control only when opened from the keyboard', () => {
    const { unmount } = render(<Harness focusOnOpen={false} />);
    opener().focus();
    fireEvent.click(opener());
    expect(document.activeElement).toBe(opener());
    unmount();
    render(<Harness focusOnOpen />);
    opener().focus();
    fireEvent.click(opener());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Layer' }));
  });

  it('closes on Escape from anywhere and returns focus to where it was', () => {
    render(<Harness focusOnOpen />);
    opener().focus();
    fireEvent.click(opener());
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener());
    // Pointer-opened, focus elsewhere: Escape on the page still closes it.
    fireEvent.click(opener());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the innermost sub-panel first, back to its trigger', () => {
    render(<Harness focusOnOpen />);
    opener().focus();
    fireEvent.click(opener());
    const style = screen.getByRole('button', { name: 'Style' });
    style.focus();
    fireEvent.click(style);
    const sub = screen.getByRole('dialog', { name: 'Style' });
    expect(sub.getAttribute('data-menu-parent')).toBe(
      screen.getByRole('dialog', { name: 'Element menu' }).id,
    );
    expect(sub.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Style' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Element menu' })).toBeTruthy();
    expect(document.activeElement).toBe(style);
  });

  it('lets a control that handles Escape itself keep it', () => {
    const onClose = vi.fn();
    render(
      <Panel label="Cell menu" onClose={onClose} focusOnOpen>
        <input
          aria-label="Name"
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.preventDefault();
          }}
        />
      </Panel>,
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name' }), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
