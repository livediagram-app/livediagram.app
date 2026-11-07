// @vitest-environment jsdom

// The tab bar and a connected tab's page, told apart from props (connected-tab-store.ts): a person's press, how fresh
// it is, and which connections the last open found broken.
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CONNECTED_PICK_FRESH_MS,
  connectedTabBroken,
  pickConnectedTab,
  pickIsFresh,
  resetConnectedTabStoreForTests,
  setConnectedTabBroken,
  useConnectedTabBroken,
  useConnectedTabPick,
} from './connected-tab-store';

afterEach(() => resetConnectedTabStoreForTests());

describe('picks', () => {
  it('records each press on a tab with a new nonce, and only that tab sees it', () => {
    const one = renderHook(() => useConnectedTabPick('t1'));
    const two = renderHook(() => useConnectedTabPick('t2'));
    expect(one.result.current).toBeNull();
    act(() => pickConnectedTab('t1', 1000));
    const first = one.result.current;
    expect(first).toEqual({ nonce: 1, at: 1000 });
    expect(two.result.current).toBeNull();
    act(() => pickConnectedTab('t1', 2000));
    expect(one.result.current?.nonce).toBe(2);
  });

  it('counts a press fresh for a page that mounts within the window only', () => {
    expect(pickIsFresh(null, 0)).toBe(false);
    expect(pickIsFresh({ nonce: 1, at: 0 }, CONNECTED_PICK_FRESH_MS)).toBe(true);
    expect(pickIsFresh({ nonce: 1, at: 0 }, CONNECTED_PICK_FRESH_MS + 1)).toBe(false);
  });
});

describe('broken', () => {
  it('marks and mends a connection, read once and kept current', () => {
    const dot = renderHook(() => useConnectedTabBroken('cn_a'));
    expect(dot.result.current).toBe(false);
    act(() => setConnectedTabBroken('cn_a', true));
    expect(dot.result.current).toBe(true);
    expect(connectedTabBroken('cn_a')).toBe(true);
    // The same answer again changes nothing.
    act(() => setConnectedTabBroken('cn_a', true));
    act(() => setConnectedTabBroken('cn_a', false));
    expect(dot.result.current).toBe(false);
    expect(connectedTabBroken('cn_a')).toBe(false);
  });
});

describe('on the server', () => {
  it('reads no press and nothing broken', () => {
    pickConnectedTab('t1');
    setConnectedTabBroken('cn_a', true);
    function Probe() {
      const pick = useConnectedTabPick('t1');
      const broken = useConnectedTabBroken('cn_a');
      return createElement('span', null, `${pick === null}:${broken}`);
    }
    expect(renderToString(createElement(Probe))).toContain('true:false');
  });
});
