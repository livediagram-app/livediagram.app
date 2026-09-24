// The three-way panel layout preference (spec/148) and its legacy flag.

import { describe, expect, it } from 'vitest';
import { PANEL_LAYOUTS, resolvePanelLayout, withPanelLayout } from './user-preferences';

describe('resolvePanelLayout', () => {
  it('reads the legacy flag when no layout has been chosen', () => {
    // Nobody's layout may move on the day the choice ships.
    expect(resolvePanelLayout({})).toBe('floating');
    expect(resolvePanelLayout({ minimalPanels: false })).toBe('floating');
    expect(resolvePanelLayout({ minimalPanels: true })).toBe('minimal');
  });

  it('lets an explicit layout win over the legacy flag', () => {
    expect(resolvePanelLayout({ panelLayout: 'toolbar', minimalPanels: true })).toBe('toolbar');
    expect(resolvePanelLayout({ panelLayout: 'floating', minimalPanels: true })).toBe('floating');
  });

  it('falls back to the legacy flag for a layout this client does not know', () => {
    const fromNewerClient = { panelLayout: 'sidebar', minimalPanels: true } as never;
    expect(resolvePanelLayout(fromNewerClient)).toBe('minimal');
  });
});

describe('withPanelLayout', () => {
  it('round-trips every layout', () => {
    for (const layout of PANEL_LAYOUTS) {
      expect(resolvePanelLayout(withPanelLayout({}, layout))).toBe(layout);
    }
  });

  it('keeps the legacy flag in step so older readers see the nearest layout', () => {
    expect(withPanelLayout({}, 'floating').minimalPanels).toBe(false);
    expect(withPanelLayout({}, 'minimal').minimalPanels).toBe(true);
    // Toolbar keeps Floating's panels, so a client that only knows the
    // boolean shows it as Floating.
    expect(withPanelLayout({}, 'toolbar').minimalPanels).toBe(false);
  });

  it('leaves every other preference alone', () => {
    expect(withPanelLayout({ showMinimap: false }, 'toolbar').showMinimap).toBe(false);
  });
});
