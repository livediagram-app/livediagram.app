// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DEFAULT_AVATAR_CONFIG } from '@liveworkspace/avatar/config';
import type { CanvasChromeProps } from './CanvasChrome';
import { useCanvasToolPanels } from './useCanvasToolPanels';

// docs/specs/008-canvas/avatar-mode.md "The Avatar Panel": its button shows in Zen, so its panel does too; only the
// welcome flow hides it.
const avatarPanel = ({ zen, welcome }: { zen: boolean; welcome: boolean }) =>
  renderHook(() =>
    useCanvasToolPanels({
      props: {
        canvasTool: 'avatar',
        avatarConfig: DEFAULT_AVATAR_CONFIG,
        welcomeOpen: welcome,
        zenMode: zen,
      } as unknown as CanvasChromeProps,
      chromeHidden: zen || welcome,
      panelWiringFor: (() => ({})) as never,
      avatarPopover: { anchor: undefined, onClose: () => {} },
    }),
  ).result.current.avatarEl;

describe('the Avatar panel', () => {
  it('opens in Zen, where its button stays', () => {
    expect(avatarPanel({ zen: true, welcome: false })).not.toBeNull();
    expect(avatarPanel({ zen: false, welcome: false })).not.toBeNull();
  });

  it('stays hidden while the welcome flow is open', () => {
    expect(avatarPanel({ zen: false, welcome: true })).toBeNull();
  });
});
