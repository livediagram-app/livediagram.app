// @vitest-environment jsdom
// Button Labels (docs/specs/007-editor/editor-app.md "Named on a wide desktop"): the bottom-right
// buttons are named on a wide screen unless the reader turned the names off; never on a narrow one.
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const wide = vi.hoisted(() => ({ value: true }));
vi.mock('@livediagram/ui', () => ({ useMediaQuery: () => wide.value }));

import { DockNamesProvider, useDockNames } from './useDockNames';

function named(setting: boolean | undefined, isWide: boolean): boolean {
  wide.value = isWide;
  const wrapper =
    setting === undefined
      ? undefined
      : ({ children }: { children: ReactNode }) => (
          <DockNamesProvider value={setting}>{children}</DockNamesProvider>
        );
  return renderHook(() => useDockNames(), { wrapper }).result.current;
}

describe('useDockNames', () => {
  it('names the buttons on a wide screen by default', () => {
    expect(named(undefined, true)).toBe(true);
    expect(named(true, true)).toBe(true);
  });

  it('drops the names when the setting is off', () => {
    expect(named(false, true)).toBe(false);
  });

  it('never names them on a narrow screen, whatever the setting', () => {
    expect(named(true, false)).toBe(false);
    expect(named(undefined, false)).toBe(false);
  });
});
