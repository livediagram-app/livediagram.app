// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NAME_TRAY_MIN_WIDTH_PX, NameTray } from './NameTray';
import { PALETTE_TRAY_MIN_WIDTH_PX } from './PaletteTray';

// liveworkspace/docs/specs/011-workbench/first-edit.md "A visitor's name": a guest visitor's name is defaulted, and this
// standing tray says so, with Change Name and Keep It; nothing blocks the canvas.

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function mountStrip() {
  const root = document.createElement('div');
  root.setAttribute('data-toolbar-palette', '');
  const card = document.createElement('div');
  card.setAttribute('data-tour-id', 'palette');
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 12, 600, 46));
  root.append(card);
  document.body.append(root);
}

describe('the name tray', () => {
  it('hangs from the strip as a standing message, naming the visitor, with Change Name first', () => {
    mountStrip();
    const onChange = vi.fn();
    const onKeep = vi.fn();
    render(<NameTray name="Clever Marlin" onChange={onChange} onKeep={onKeep} />);
    const tray = screen.getByRole('status');
    expect(tray.hasAttribute('data-yields-to-mode')).toBe(true);
    // It goes first: another standing message steps aside while it shows (globals.css).
    expect(tray.hasAttribute('data-standing-first')).toBe(true);
    expect(tray.textContent).toContain('You’re Clever Marlin here');
    const [change, keep] = screen.getAllByRole('button');
    expect(change!.textContent).toBe('Change Name');
    expect(keep!.textContent).toBe('Keep It');
    fireEvent.click(change!);
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(keep!);
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('keeps the sentence for screen readers on a phone, where only the actions fit', () => {
    mountStrip();
    render(<NameTray name="Clever Marlin" onChange={() => {}} onKeep={() => {}} />);
    const sentence = screen.getByText('Clever Marlin').parentElement!;
    expect(sentence.className).toContain('max-sm:sr-only');
  });

  it('asks for a wider slot than the default tray, so a long placeholder name and both actions fit', () => {
    expect(NAME_TRAY_MIN_WIDTH_PX).toBeGreaterThan(PALETTE_TRAY_MIN_WIDTH_PX);
  });

  it("stands at the top centre without a strip (a Viewer's screen)", () => {
    const { container } = render(
      <NameTray name="Clever Marlin" onChange={() => {}} onKeep={() => {}} />,
    );
    const pill = container.querySelector<HTMLElement>('[data-name-tray]')!;
    expect(pill).not.toBeNull();
    expect(pill.style.top).toBe('80px');
    expect(screen.getByRole('button', { name: 'Change Name' })).toBeTruthy();
  });

  it('stands clear of a dock it is told of rather than over its tools', () => {
    const dock = document.createElement('div');
    dock.setAttribute('data-whiteboard-dock', '');
    vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 50, 600, 60));
    document.body.append(dock);
    const { container } = render(
      <NameTray
        name="Clever Marlin"
        onChange={() => {}}
        onKeep={() => {}}
        dockSelector="[data-whiteboard-dock]"
      />,
    );
    expect(container.querySelector<HTMLElement>('[data-name-tray]')!.style.top).toBe('120px');
  });
});
