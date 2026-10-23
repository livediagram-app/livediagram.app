import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const subscribeNever = () => () => {};
const bodyOf = () => document.body;
const noHost = () => null;

// Renders into document.body. A portal opened in the browser (a menu, a dialog) is there in its first render, so
// its owner's layout effect can measure it (PortalMenu places itself against its anchor that way); one rendered on
// the server, or hydrated, has no host until the browser's own render.
export function Portal({ children }: { children: ReactNode }) {
  const host = useSyncExternalStore<HTMLElement | null>(subscribeNever, bodyOf, noHost);
  return host ? createPortal(children, host) : null;
}
