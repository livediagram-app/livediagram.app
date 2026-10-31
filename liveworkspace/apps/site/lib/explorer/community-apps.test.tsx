// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { AppName } from '@liveworkspace/sites';
import { useCommunityAppsOn } from './community-apps';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Renders the hook and hands back its latest answer.
function mount(
  apps: readonly AppName[],
  ask: boolean,
  fetchEnabled: (base: string) => Promise<boolean>,
) {
  const latest = { current: (_app: AppName) => false };
  function Probe() {
    const on = useCommunityAppsOn(apps, ask, fetchEnabled);
    useEffect(() => {
      latest.current = on;
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(<Probe />));
  return { on: (app: AppName) => latest.current(app), root };
}

describe('which apps’ Community the Explorer offers', () => {
  it('asks nothing until an item of an app is shared, then that app alone, once', async () => {
    const fetchEnabled = vi.fn(async () => true);
    const { on, root } = mount(['livediagram', 'livedocuments'], true, fetchEnabled);
    expect(fetchEnabled).not.toHaveBeenCalled();
    expect(on('livedocuments')).toBe(true);
    expect(on('livedocuments')).toBe(true);
    expect(fetchEnabled).toHaveBeenCalledTimes(1);
    expect(fetchEnabled).toHaveBeenCalledWith('https://www.livedocuments.app/api');
    act(() => root.unmount());
  });

  it('turns an app off once it says so, and never offers another app or a guest', async () => {
    let answer: (on: boolean) => void = () => {};
    const fetchEnabled = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)));
    const { on, root } = mount(['livedocuments'], true, fetchEnabled);
    // Assumed on until it answers.
    expect(on('livedocuments')).toBe(true);
    await act(async () => answer(false));
    expect(on('livedocuments')).toBe(false);
    expect(on('liveplanner')).toBe(false);
    act(() => root.unmount());

    const guest = mount(['livedocuments'], false, fetchEnabled);
    expect(guest.on('livedocuments')).toBe(false);
    act(() => guest.root.unmount());
  });
});
