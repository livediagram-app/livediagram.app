// @vitest-environment jsdom

// The tab bar and a connected tab's page, told apart from props (connected-tab-store.ts): which connections the last
// open found broken.
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  connectedTabBroken,
  resetConnectedTabStoreForTests,
  setConnectedTabBroken,
  useConnectedTabBroken,
} from './connected-tab-store';

afterEach(() => resetConnectedTabStoreForTests());

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
  it('reads nothing broken', () => {
    setConnectedTabBroken('cn_a', true);
    function Probe() {
      const broken = useConnectedTabBroken('cn_a');
      return createElement('span', null, `broken:${broken}`);
    }
    expect(renderToString(createElement(Probe))).toContain('broken:false');
  });
});
