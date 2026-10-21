'use client';

import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

// SSR-safe wrapper around react-dom's createPortal targeted at
// document.body. Every dialog / popover / context menu / toast in
// the editor was open-coding the same pair of lines:
//
//   if (typeof document === 'undefined') return null;
//   return createPortal(<div>...</div>, document.body);
//
// 12 sites today, with a couple silently missing the SSR guard and
// relying on the parent's `if (!open) return null` to keep them from
// ever rendering server-side. Centralising means there's one
// canonical "render this subtree at the top of the DOM" primitive
// and new portal-using components don't have to relearn the guard.
//
// Intentionally NOT a `target` prop: every existing caller mounts on
// document.body and adding configurability before there's a second
// target invites bikeshedding.
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
