// @vitest-environment jsdom

// The landing funnel's editor end (spec/153): /new reads the CTA source from
// `via`, counts the arrival once, strips the parameter from the address bar,
// and counts the diagram at most once per arrival.

import { renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));

import { useCtaAttribution } from './useCtaAttribution';

function arriveAt(url: string) {
  window.history.replaceState(null, '', url);
}

describe('useCtaAttribution', () => {
  beforeEach(() => track.mockClear());
  afterEach(() => arriveAt('/'));

  it('counts an arrival from a known CTA and strips only `via`', () => {
    arriveAt('/new?template=kanban&via=Home.Gallery&folder=f1#top');
    renderHook(() => useCtaAttribution());
    expect(track).toHaveBeenCalledExactlyOnceWith('Cta', 'Opened', 'Home.Gallery');
    expect(window.location.pathname).toBe('/new');
    expect(window.location.search).toBe('?template=kanban&folder=f1');
    expect(window.location.hash).toBe('#top');
  });

  it('counts the diagram once, however often the commit runs', () => {
    arriveAt('/new?via=Home.Hero');
    const { result } = renderHook(() => useCtaAttribution());
    result.current.trackCreated();
    result.current.trackCreated();
    expect(track.mock.calls).toEqual([
      ['Cta', 'Opened', 'Home.Hero'],
      ['Cta', 'Created', 'Home.Hero'],
    ]);
  });

  it('counts the arrival once under StrictMode', () => {
    arriveAt('/new?blank=1&via=Home.HeroDraw');
    renderHook(() => useCtaAttribution(), { wrapper: StrictMode });
    expect(track).toHaveBeenCalledExactlyOnceWith('Cta', 'Opened', 'Home.HeroDraw');
    expect(window.location.search).toBe('?blank=1');
  });

  it('ignores an unknown source, but still strips it', () => {
    arriveAt('/new?via=Somewhere.Else');
    const { result } = renderHook(() => useCtaAttribution());
    result.current.trackCreated();
    expect(track).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('sends nothing for a plain /new', () => {
    arriveAt('/new?folder=f1');
    const { result } = renderHook(() => useCtaAttribution());
    result.current.trackCreated();
    expect(track).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?folder=f1');
  });
});
