// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { useRef, type Ref } from 'react';
import { describe, expect, it } from 'vitest';
import { createViewportStore, type View } from '../../lib/viewport-store';
import { ViewportStoreProvider, useViewportOf } from './useViewportStore';
import { useViewportTransform, viewportTransform } from './useViewportTransform';

const positionOf = (v: View) => `${v.offset.x * v.zoom}px ${v.offset.y * v.zoom}px`;
const zoomOf = (v: View) => v.zoom;

function Board({
  onRender,
  position = positionOf,
  backgroundRef,
  bare = false,
}: {
  onRender: () => void;
  bare?: boolean;
  position?: (v: View) => string | undefined;
  backgroundRef?: Ref<HTMLElement>;
}) {
  onRender();
  useViewportOf(zoomOf);
  const mainRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const view = useViewportTransform(wrapperRef, backgroundRef ?? mainRef, position);
  return (
    <main ref={mainRef} data-testid="main">
      {bare ? null : (
        <div
          ref={wrapperRef}
          data-testid="wrapper"
          style={{ transform: viewportTransform(view) }}
        />
      )}
    </main>
  );
}

function setup(props: Partial<Parameters<typeof Board>[0]> = {}) {
  const store = createViewportStore(1);
  const renders = { n: 0 };
  const utils = render(
    <ViewportStoreProvider store={store}>
      <Board onRender={() => (renders.n += 1)} {...props} />
    </ViewportStoreProvider>,
  );
  const wrapper = utils.queryByTestId('wrapper') as HTMLElement;
  const main = utils.getByTestId('main');
  return { store, renders, wrapper, main, ...utils };
}

describe('useViewportTransform', () => {
  it('draws the first frame from the view', () => {
    const { wrapper, main } = setup();
    expect(wrapper.style.transform).toBe('scale(1) translate(0px, 0px)');
    expect(main.style.backgroundPosition).toBe('0px 0px');
  });

  it('moves the wrapper and the pattern on a pan without rendering', () => {
    const { store, renders, wrapper, main } = setup();
    const before = renders.n;
    act(() => {
      for (let i = 1; i <= 60; i++) store.setOffset({ x: -i * 4, y: i });
    });
    expect(renders.n).toBe(before);
    expect(wrapper.style.transform).toBe('scale(1) translate(-240px, 60px)');
    expect(main.style.backgroundPosition).toBe('-240px 60px');
  });

  it('renders on a zoom and keeps the panned offset', () => {
    const { store, renders, wrapper, main } = setup();
    act(() => store.setOffset({ x: 10, y: 20 }));
    const before = renders.n;
    act(() => store.setZoom(2));
    expect(renders.n).toBe(before + 1);
    expect(wrapper.style.transform).toBe('scale(2) translate(10px, 20px)');
    expect(main.style.backgroundPosition).toBe('20px 40px');
  });

  it('leaves the background alone when there is no pattern or no element to hold one', () => {
    const none = setup({ position: () => undefined });
    act(() => none.store.setOffset({ x: 5, y: 5 }));
    expect(none.main.style.backgroundPosition).toBe('');
    none.unmount();
    const callback = setup({ backgroundRef: () => {} });
    act(() => callback.store.setOffset({ x: 5, y: 5 }));
    expect(callback.main.style.backgroundPosition).toBe('');
    expect(callback.wrapper.style.transform).toBe('scale(1) translate(5px, 5px)');
  });

  it('still pans the pattern before the wrapper mounts', () => {
    const { store, main } = setup({ bare: true });
    act(() => store.setOffset({ x: 3, y: 4 }));
    expect(main.style.backgroundPosition).toBe('3px 4px');
  });

  it('stops writing once unmounted', () => {
    const { store, wrapper, unmount } = setup();
    unmount();
    act(() => store.setOffset({ x: 9, y: 9 }));
    expect(wrapper.style.transform).toBe('scale(1) translate(0px, 0px)');
  });
});
