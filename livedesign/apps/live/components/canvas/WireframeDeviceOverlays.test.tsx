// @vitest-environment jsdom
// A wireframe screen's status bar is inked for the screen as shown (docs/specs/007-editor/wireframe-pages.md
// "The screen": in ink that reads on the screen's background; the plain paper is the dark sheet in the dark
// editor). A screen with no fill of its own was always inked for white paper, so in the dark editor its 9:41
// was near black on the dark sheet.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LaidOutPage } from '@livedesign/design';

const appearance = vi.hoisted(() => ({ value: 'light' as 'light' | 'dark' }));
vi.mock('@/hooks/ui/useAppearance', () => ({
  useAppearance: () => ({ appearance: appearance.value }),
}));

import { WireframeDeviceOverlays } from './WireframeDeviceOverlays';

const phone = (background?: LaidOutPage['background']): LaidOutPage => ({
  id: 'p',
  orientation: 'portrait',
  kind: 'wireframe',
  size: 'device',
  device: 'iphone',
  index: 0,
  rect: { x: 0, y: 0, width: 393, height: 852 },
  ...(background ? { background } : {}),
});

const overHtml = (page: LaidOutPage) => {
  const { container } = render(<WireframeDeviceOverlays pages={[page]} />);
  return container.querySelector('[data-wireframe-over]')?.innerHTML ?? '';
};

afterEach(() => {
  cleanup();
  appearance.value = 'light';
});

describe('WireframeDeviceOverlays', () => {
  it('inks the plain paper dark in the light editor', () => {
    const html = overHtml(phone());
    expect(html).toContain('#0f172a');
    expect(html).not.toContain('#ffffff');
  });

  it('inks the plain paper white in the dark editor, where it is the dark sheet', () => {
    appearance.value = 'dark';
    const html = overHtml(phone());
    expect(html).toContain('#ffffff');
    expect(html).not.toContain('#0f172a');
  });

  it('follows a screen fill of its own in either editor', () => {
    appearance.value = 'dark';
    expect(overHtml(phone({ fill: { kind: 'solid', color: '#ffffff' } }))).toContain('#0f172a');
    cleanup();
    appearance.value = 'light';
    expect(overHtml(phone({ fill: { kind: 'solid', color: '#111827' } }))).toContain('#ffffff');
  });
});
