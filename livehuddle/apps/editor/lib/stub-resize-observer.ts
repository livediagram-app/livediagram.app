// jsdom has no ResizeObserver; the toolbar, menus and context menus measure with one. For component tests.
export function stubResizeObserver(): void {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
