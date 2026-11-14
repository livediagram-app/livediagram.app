// jsdom has no ResizeObserver; toolbars, menus and context menus measure with one. For component tests: installs an
// inert one when the environment has none, and leaves a real or already-stubbed one alone.
export function stubResizeObserver() {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
