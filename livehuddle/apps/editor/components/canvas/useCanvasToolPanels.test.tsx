// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DEFAULT_AVATAR_CONFIG } from '@liveworkspace/avatar/config';
import type { CanvasChromeProps } from './CanvasChrome';
import { useCanvasToolPanels } from './useCanvasToolPanels';

// docs/specs/008-canvas/avatar-mode.md "The Avatar Panel": its panel shows while the rest of the chrome is away;
// only the welcome flow hides it.
const avatarPanel = ({ away, welcome }: { away: boolean; welcome: boolean }) =>
  renderHook(() =>
    useCanvasToolPanels({
      props: {
        canvasTool: 'avatar',
        avatarConfig: DEFAULT_AVATAR_CONFIG,
        welcomeOpen: welcome,
        chromeAway: away,
      } as unknown as CanvasChromeProps,
      chromeHidden: away || welcome,
      panelWiringFor: (() => ({})) as never,
      avatarPopover: { anchor: undefined, onClose: () => {} },
    }),
  ).result.current.avatarEl;

describe('the Avatar panel', () => {
  it('opens while the rest of the chrome is away', () => {
    expect(avatarPanel({ away: true, welcome: false })).not.toBeNull();
    expect(avatarPanel({ away: false, welcome: false })).not.toBeNull();
  });

  it('stays hidden while the welcome flow is open', () => {
    expect(avatarPanel({ away: false, welcome: true })).toBeNull();
  });
});
