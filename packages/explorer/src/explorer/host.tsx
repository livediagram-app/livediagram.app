'use client';

// What a host adds to the Explorer's own chrome, beside the props the rest of the Explorer reads through its
// context: rows of its own in the sidebar's More group (liveworkspace.app's This Browser, which opens an app's
// offline view), and the filter's words.

import { createContext, useContext, type ReactNode } from 'react';
import type { ThisBrowserHost } from './ThisBrowser';

/** A sidebar row of the host's: it leaves the Explorer for `href` (another app's page, say). */
export type SidebarLink = {
  id: string;
  label: string;
  href: string;
  /** A sentence a screen reader hears after the name, and the row's tooltip. */
  description?: string;
  icon?: 'browser';
};

export type ExplorerHostExtras = {
  sidebarLinks: readonly SidebarLink[];
  /** The filter's every-app choice ("All" by default). */
  allLabel: string;
  /** The host app's items kept only in this browser, where the host can read them (ThisBrowser.tsx). */
  thisBrowser: ThisBrowserHost | null;
};

const DEFAULTS: ExplorerHostExtras = { sidebarLinks: [], allLabel: 'All', thisBrowser: null };
const Ctx = createContext<ExplorerHostExtras>(DEFAULTS);

export function useHostExtras(): ExplorerHostExtras {
  return useContext(Ctx);
}

export function HostExtrasProvider({
  value,
  children,
}: {
  value: ExplorerHostExtras;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** A browser window: the This Browser row's icon. */
export function BrowserIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={(24 / size) * 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 9h20M6 6.5h.01M9 6.5h.01" />
    </svg>
  );
}
