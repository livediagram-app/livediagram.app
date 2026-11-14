import type { ComponentType } from 'react';

// The Explorer panel's loader (docs/specs/016-platform/web-performance.md): in the editor it is only ever a popover
// under the canvas's menu button, which most visits never open, so its code stays out of the editor page's first
// load. The editor fetches it once idle (EDITOR_SURFACE_CODE), so a first open does not wait. Each editor hands the
// loader to `next/dynamic` in its components/panels/LazyExplorer.tsx, with its own panel module.
//
// A load that fails (offline, docs/specs/007-editor/load-recovery.md "Offline") draws nothing rather than throwing
// into the screen around it; the page reloads itself on reconnecting.
export function explorerLoader<P>(
  loadExplorerPanel: () => Promise<{ Explorer: ComponentType<P> }>,
): () => Promise<ComponentType<P>> {
  return () =>
    loadExplorerPanel().then(
      (m) => m.Explorer,
      (err: unknown) => {
        console.warn('[explorer] panel code failed to load', err);
        return function ExplorerUnavailable() {
          return null;
        };
      },
    );
}
