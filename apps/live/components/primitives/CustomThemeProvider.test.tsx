// @vitest-environment jsdom

// The custom theme list (docs/specs/011-theme/custom-themes.md): loading while the owner's list is in
// flight, settled once it lands or fails, and never loading without an owner.

import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomTheme } from '@livediagram/api-schema';
import { CustomThemeProvider, useCustomThemes } from './CustomThemeProvider';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/swatch-override-prefs', () => ({ pruneCustomThemeSwatchOverrides: vi.fn() }));
vi.mock('@/lib/custom-theme-registry', () => ({
  registerCustomTheme: vi.fn(),
  registerCustomThemes: vi.fn(),
  unregisterCustomTheme: vi.fn(),
}));
const list = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({
  apiListCustomThemes: list,
  apiCreateCustomTheme: vi.fn(),
  apiDeleteCustomTheme: vi.fn(),
  apiUpdateCustomTheme: vi.fn(),
}));

const theme = { id: 'custom:1', name: 'Mine' } as CustomTheme;

function themes(initialOwner: string | null) {
  const owner = { current: initialOwner };
  const view = renderHook(() => useCustomThemes(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <CustomThemeProvider ownerId={owner.current}>{children}</CustomThemeProvider>
    ),
  });
  const switchOwner = (next: string | null) => {
    owner.current = next;
    view.rerender();
  };
  return { ...view, switchOwner };
}

afterEach(() => list.mockReset());

describe('CustomThemeProvider', () => {
  it('loads the owner list', async () => {
    let resolve: (t: CustomTheme[]) => void = () => {};
    list.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = themes('me');
    expect(result.current.loading).toBe(true);
    await act(async () => resolve([theme]));
    expect(result.current.loading).toBe(false);
    expect(result.current.themes).toEqual([theme]);
  });

  it('settles when the list fails', async () => {
    list.mockRejectedValue(new Error('down'));
    const { result } = themes('me');
    await act(async () => {});
    expect(result.current.loading).toBe(false);
  });

  it('is not loading without an owner', async () => {
    const { result } = themes(null);
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });

  it('loads again for a new owner', async () => {
    list.mockResolvedValueOnce([theme]);
    const { result, switchOwner } = themes('me');
    await act(async () => {});
    list.mockReturnValueOnce(new Promise(() => {}));
    switchOwner('other');
    expect(result.current.loading).toBe(true);
  });
});

// A workbench reads the person's themes and writes none (docs/specs/013-workspace/blueprints/
// workbench-embeds.md, Surface table).
describe('CustomThemeProvider writes', () => {
  it('are offered by default, withheld when read only, and never without a provider', () => {
    list.mockResolvedValue([]);
    expect(themes(null).result.current.writable).toBe(true);

    const readOnly = renderHook(() => useCustomThemes(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <CustomThemeProvider ownerId={null} readOnly>
          {children}
        </CustomThemeProvider>
      ),
    });
    expect(readOnly.result.current.writable).toBe(false);
    expect(renderHook(() => useCustomThemes()).result.current.writable).toBe(false);
  });
});
