// @vitest-environment jsdom

// A whiteboard dock pill (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows") on a touch
// screen (docs/specs/004-interface-design/touch-targets.md): its 36px buttons reach 44px-tall tap areas,
// as the Toolbar layout strip's tiles do, and a tool's shortcut letter is not drawn.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
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
  it('carries the phone toolbar items, so its 36px buttons get the vertical touch pad', () => {
    renderDock();
    const pill = screen.getByRole('toolbar', { name: 'Tools' });
    for (const cls of PHONE_TOOLBAR_ITEMS.split(' ')) expect(pill.classList).toContain(cls);
    expect(PHONE_TOOLBAR_ITEMS).toContain('[&_.h-9]:touch-target-y');
    expect(screen.getByRole('button', { name: /Select/ }).className).toMatch(/\bh-9\b/);
  });

  it('hides the shortcut letter on a coarse pointer', () => {
    renderDock();
    const letter = screen.getByText('V');
    expect(letter.className).toMatch(/\bpointer-coarse:hidden\b/);
  });
});
