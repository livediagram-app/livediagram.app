'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { loadExplorerPanel } from '@/lib/editor-deferred-code';
import type { ExplorerProps } from './Explorer.types';

// The Explorer panel, loaded the first time it is drawn (docs/specs/016-platform/web-performance.md): in the editor
// it is a popover under the menu button that most visits never open, and the error and deleted screens that
// show it are rare, so its code stays out of the project page's first load. The editor fetches it once idle
// (EDITOR_SURFACE_CODE), so a first open does not wait.
//
// A load that fails (offline behind the load-error card, docs/specs/007-editor/load-recovery.md "Offline")
// draws nothing rather than throwing into the screen around it; the page reloads itself on reconnecting.
const loadExplorer = (): Promise<ComponentType<ExplorerProps>> =>
  loadExplorerPanel().then(
    (m) => m.Explorer,
    (err: unknown) => {
      console.warn('[explorer] panel code failed to load', err);
      return function ExplorerUnavailable() {
        return null;
      };
    },
  );

export const LazyExplorer = dynamic(loadExplorer, { ssr: false });
