'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const subscribeNever = () => () => {};
const bodyOf = () => document.body;
const noHost = () => null;

// Renders into document.body: every dialog, popover, menu and toast mounts there. A portal opened in the browser
// is there in its first render, so its owner's layout effect can measure it (a menu places itself against its
// anchor that way); one rendered on the server, or hydrated, has no host until the browser's own render, so the
// server's markup and the hydrating render agree. No `typeof document` in render
// (docs/specs/003-system-architecture/react-state-and-effects.md "Rendering in the browser only").
export function Portal({ children }: { children: ReactNode }) {
  const host = useSyncExternalStore<HTMLElement | null>(subscribeNever, bodyOf, noHost);
  return host ? createPortal(children, host) : null;
}
