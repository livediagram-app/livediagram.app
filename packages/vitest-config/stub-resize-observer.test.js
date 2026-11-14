import { afterEach, describe, expect, it } from 'vitest';
import { stubResizeObserver } from './stub-resize-observer.js';

const real = globalThis.ResizeObserver;
afterEach(() => {
  globalThis.ResizeObserver = real;
});

describe('stubResizeObserver', () => {
  it('installs an inert observer where there is none, and keeps one already there', () => {
    delete globalThis.ResizeObserver;
    stubResizeObserver();
    const Stub = globalThis.ResizeObserver;
    const observer = new Stub();
    expect(() => {
      observer.observe();
      observer.unobserve();
      observer.disconnect();
    }).not.toThrow();
    stubResizeObserver();
    expect(globalThis.ResizeObserver).toBe(Stub);
  });
});
