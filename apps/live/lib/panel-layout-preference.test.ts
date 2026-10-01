// The two-way panel layout preference (docs/specs/007-editor/toolbar-layout.md).

import { describe, expect, it } from 'vitest';
import { PANEL_LAYOUTS, resolvePanelLayout, withPanelLayout } from './user-preferences';

describe('resolvePanelLayout', () => {
  it('defaults to Floating when no layout has been chosen', () => {
    expect(resolvePanelLayout({})).toBe('floating');
  });

  it('honours an explicit layout', () => {
    expect(resolvePanelLayout({ panelLayout: 'toolbar' })).toBe('toolbar');
    expect(resolvePanelLayout({ panelLayout: 'floating' })).toBe('floating');
  });

  it('reads a retired or unknown layout as the default', () => {
    // 'minimal' was a third layout; a stored pick of it now lands on Floating.
    expect(resolvePanelLayout({ panelLayout: 'minimal' } as never)).toBe('floating');
    expect(resolvePanelLayout({ panelLayout: 'sidebar' } as never)).toBe('floating');
    expect(resolvePanelLayout({ minimalPanels: true } as never)).toBe('floating');
  });

  it('shows Toolbar on a phone whatever is stored', () => {
    const mobile = { mobile: true };
    expect(resolvePanelLayout({}, mobile)).toBe('toolbar');
    expect(resolvePanelLayout({ panelLayout: 'floating' }, mobile)).toBe('toolbar');
    expect(resolvePanelLayout({ panelLayout: 'toolbar' }, mobile)).toBe('toolbar');
    expect(resolvePanelLayout({ panelLayout: 'minimal' } as never, mobile)).toBe('toolbar');
    // Desktop is unchanged.
    expect(resolvePanelLayout({}, { mobile: false })).toBe('floating');
  });
});

describe('withPanelLayout', () => {
  it('round-trips every layout', () => {
    for (const layout of PANEL_LAYOUTS) {
      expect(resolvePanelLayout(withPanelLayout({}, layout))).toBe(layout);
    }
  });

  it('leaves every other preference alone', () => {
    expect(withPanelLayout({ showMinimap: false }, 'toolbar').showMinimap).toBe(false);
  });
});
