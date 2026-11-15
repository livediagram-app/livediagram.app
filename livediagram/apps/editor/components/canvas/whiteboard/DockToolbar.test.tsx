// @vitest-environment jsdom

// A whiteboard dock pill (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows") on a touch
// screen (docs/specs/004-interface-design/touch-targets.md, draw-mode.md "On a touch screen"): its 36px buttons
// reach 44 x 44 tap areas drawn behind the tiles, so the gaps between them pick a tool too, and a tool's shortcut
// letter is not drawn.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PACKED_TOOLBAR_ITEMS } from '@liveworkspace/workbench/components/chrome/phone-toolbar-items';
import { DockButton, DockToolbar } from './DockToolbar';

afterEach(cleanup);

function renderDock() {
  render(
    <DockToolbar label="Tools" group="tools">
      <DockButton itemKey="select" label="Select" icon={<svg />} shortcut="V" onPress={() => {}} />
    </DockToolbar>,
  );
}

describe('DockToolbar on a touch screen', () => {
  it('gives its 36px buttons the full 44 x 44 pad, behind the tiles in its own stacking context', () => {
    renderDock();
    const pill = screen.getByRole('toolbar', { name: 'Tools' });
    for (const cls of PACKED_TOOLBAR_ITEMS.split(' ')) expect(pill.classList).toContain(cls);
    // Both ways, not the vertical-only pad that left the 2px gaps falling through to the page.
    expect(pill.classList).toContain('[&_.h-9]:touch-target-packed');
    expect(pill.classList).not.toContain('[&_.h-9]:touch-target-y');
    // Without its own stacking context the pads would drop behind the card and take nothing.
    expect(pill.classList).toContain('isolate');
    expect(pill.classList).toContain('[&_.h-9]:relative');
    expect(screen.getByRole('button', { name: /Select/ }).className).toMatch(/\bh-9\b/);
  });

  it('hides the shortcut letter on a coarse pointer', () => {
    renderDock();
    const letter = screen.getByText('V');
    expect(letter.className).toMatch(/\bpointer-coarse:hidden\b/);
  });
});

// A centred dock can land on a half pixel; an outer ring then lost its left edge under the tile's own background.
describe('DockButton pressed', () => {
  it('draws its ring inside the tile', () => {
    render(
      <DockToolbar label="Tools" group="tools">
        <DockButton itemKey="pen" label="Marker 1" icon={<svg />} pressed onPress={() => {}} />
      </DockToolbar>,
    );
    const pen = screen.getByRole('button', { name: /Marker 1/ });
    expect(pen.className).toMatch(/\bring-1\b/);
    expect(pen.className).toMatch(/\bring-inset\b/);
  });
});
