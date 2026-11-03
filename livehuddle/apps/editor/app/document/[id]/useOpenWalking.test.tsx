// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { useOpenWalking } from './useOpenWalking';

// docs/specs/008-canvas/avatar-mode.md "Opening walking": once per tab per visit, when the tab's content has arrived,
// for every role (the hook takes no role: walking writes nothing), never in an embed.
const walkIn = (): Element => ({ ...createShape('mode-button', 100, 100), id: 'walk-in' });
const pad = (): Element => ({ ...createShape('avatar-pad', 0, 0), id: 'pad' });
const square = (): Element => ({ ...createShape('square', 0, 0), id: 'sq' });

type Props = {
  enabled?: boolean;
  tabId?: string;
  elements?: Element[];
  loaded?: boolean;
  walking?: boolean;
};

function setup(initial: Props = {}) {
  const openWalking = vi.fn();
  const view = renderHook(
    (p: Props) =>
      useOpenWalking({
        enabled: p.enabled ?? true,
        tabId: p.tabId ?? 't1',
        elements: p.elements ?? [walkIn()],
        layers: undefined,
        loaded: p.loaded ?? true,
        walking: p.walking ?? false,
        openWalking,
      }),
    { initialProps: initial },
  );
  return { ...view, openWalking };
}

describe('useOpenWalking', () => {
  it('opens a tab with a Walk In button walking, starting below the button', () => {
    const { result, openWalking } = setup();
    expect(openWalking).toHaveBeenCalledOnce();
    expect(result.current.walkIn).toMatchObject({ seq: 1 });
    expect(result.current.walkIn?.feet.y).toBeGreaterThan(100);
  });

  it('opens a tab with a pad walking, leaving the start to the pad', () => {
    const { result, openWalking } = setup({ elements: [pad(), walkIn()] });
    expect(openWalking).toHaveBeenCalledOnce();
    expect(result.current.walkIn).toBeNull();
  });

  it('leaves a tab that offers no walk on its tool', () => {
    const { openWalking } = setup({ elements: [square()] });
    expect(openWalking).not.toHaveBeenCalled();
  });

  it('waits for the tab to load, then judges it once', () => {
    const { rerender, openWalking } = setup({ loaded: false });
    expect(openWalking).not.toHaveBeenCalled();
    rerender({ loaded: true });
    expect(openWalking).toHaveBeenCalledOnce();
    // An edit, then leaving the mode and coming back: never again this visit.
    rerender({ loaded: true, elements: [walkIn(), square()] });
    rerender({ loaded: true, tabId: 't2', elements: [square()] });
    rerender({ loaded: true, tabId: 't1' });
    expect(openWalking).toHaveBeenCalledOnce();
  });

  it('opens another tab that offers the walk when you change to it', () => {
    const { rerender, openWalking } = setup({ elements: [square()] });
    rerender({ tabId: 't2', elements: [walkIn()] });
    expect(openWalking).toHaveBeenCalledOnce();
  });

  it('never opens walking in an embed', () => {
    const { openWalking } = setup({ enabled: false });
    expect(openWalking).not.toHaveBeenCalled();
  });

  it('asks nothing of a tab already walking, and judges it all the same', () => {
    const { rerender, openWalking } = setup({ walking: true });
    rerender({ walking: false });
    expect(openWalking).not.toHaveBeenCalled();
  });

  it('judges an empty tab afresh when a template lands on it', () => {
    const { result, rerender, openWalking } = setup({ elements: [] });
    expect(openWalking).not.toHaveBeenCalled();
    act(() => result.current.rejudge('t1'));
    rerender({ elements: [walkIn()] });
    expect(openWalking).toHaveBeenCalledOnce();
  });

  it('keeps an empty tab judged when content arrives without a template', () => {
    const { rerender, openWalking } = setup({ elements: [] });
    rerender({ elements: [walkIn()] });
    expect(openWalking).not.toHaveBeenCalled();
  });
});
