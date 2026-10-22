// @vitest-environment jsdom

// A flyout's surface (docs/specs/004-interface-design/menus.md): beside its menu on a wide screen it is frosted
// glass; on a phone it lies straight over the menu, so it is opaque there, or the menu's rows read through it.

import { cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { FlyoutPanel } from './MenuFlyoutPanel';

function panel(isMobile: boolean): HTMLElement {
  const { container } = render(
    <FlyoutPanel
      panelRef={createRef()}
      trigger={null}
      kind="control"
      isPanel={false}
      isMobile={isMobile}
      pos={{ left: 0, top: 0 }}
      icon={null}
      title="Style"
      onClose={() => {}}
    >
      <p>Presets</p>
    </FlyoutPanel>,
  );
  return container.querySelector<HTMLElement>('[data-menu-flyout]')!;
}

describe('FlyoutPanel surface', () => {
  afterEach(cleanup);

  it('is opaque on a phone, where it covers its menu', () => {
    const el = panel(true);
    expect(el.className).toContain('bg-white ');
    expect(el.className).not.toContain('bg-white/95');
    expect(el.className).not.toContain('backdrop-blur');
  });

  it('keeps the frosted glass beside its menu on a wide screen', () => {
    const el = panel(false);
    expect(el.className).toContain('bg-white/95');
    expect(el.className).toContain('backdrop-blur-sm');
  });
});
