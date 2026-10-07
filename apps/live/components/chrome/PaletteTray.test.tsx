// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModeBanner } from './ModeBanner';
import { usePaletteStripBox } from './PaletteTray';

// docs/specs/007-editor/toolbar-layout.md "Layout details": messages hang from the strip as its tray.

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

// A stand-in for ToolbarPalette's strip card, at a known place on screen.
function mountStrip({ hidden = false }: { hidden?: boolean } = {}) {
  const root = document.createElement('div');
  root.setAttribute('data-toolbar-palette', '');
  if (hidden) root.className = 'hidden';
  const card = document.createElement('div');
  card.setAttribute('data-tour-id', 'palette');
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 12, 600, 46));
  root.append(card);
  document.body.append(root);
}

function Banner({ onAction }: { onAction: () => void }) {
  const tray = usePaletteStripBox();
  return (
    <ModeBanner
      icon={<span>✎</span>}
      message="Select the board column you want this card to appear in"
      onAction={onAction}
      tray={tray}
    />
  );
}

describe('the palette tray', () => {
  it('hangs a mode banner from the strip, flush with its bottom edge and no wider', () => {
    mountStrip();
    const onAction = vi.fn();
    render(<Banner onAction={onAction} />);
    const tray = document.querySelector('[data-palette-tray]') as HTMLElement;
    expect(tray).not.toBeNull();
    expect(tray.textContent).toContain('Select the board column');
    const slot = tray.parentElement!;
    expect(slot.style.left).toBe('300px');
    expect(slot.style.width).toBe('600px');
    // Up a pixel over the strip's bottom border (12 + 46 - 1).
    expect(slot.style.top).toBe('57px');
    expect(tray.className).toContain('rounded-b-xl');
    expect(tray.className).toContain('border-t-0');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('stays a top-centre pill without a strip, or with the strip hidden', () => {
    render(<Banner onAction={() => {}} />);
    expect(document.querySelector('[data-palette-tray]')).toBeNull();
    expect(screen.getByText(/Select the board column/)).toBeTruthy();
    cleanup();
    mountStrip({ hidden: true });
    render(<Banner onAction={() => {}} />);
    expect(document.querySelector('[data-palette-tray]')).toBeNull();
  });
});
