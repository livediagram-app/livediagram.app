'use client';

// An app's own section at the top of the phone's Apps drawer (liveworkspace/docs/specs/011-workbench/phone-apps-drawer.md
// "The app's section"): a control the phone's top row no longer holds, such as livediagram's editor mode switch. The menu
// card publishes it while on a phone, and the open drawer draws it under its header. One editor runs per page, so one
// section at a time; the last to publish wins and its unpublish clears only its own.

import {
  createContext,
  useContext,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

let section: ReactNode = null;
const listeners = new Set<() => void>();
const tell = () => {
  for (const l of [...listeners]) l();
};

/** Publishes `node` as the drawer's section while `active`, and clears it when inactive or unmounted. */
export function usePhoneAppsSection(node: ReactNode, active: boolean): void {
  useLayoutEffect(() => {
    if (!active || !node) return undefined;
    section = node;
    tell();
    return () => {
      if (section !== node) return;
      section = null;
      tell();
    };
  }, [node, active]);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const read = () => section;
const readServer = () => null;

/** The section the drawer draws now, or null. */
export function usePhoneAppsSectionNode(): ReactNode {
  return useSyncExternalStore(subscribe, read, readServer);
}

// The open drawer's Close, for a section control that acts: it closes the drawer first, as a tile does, so a press
// behaves the same whether or not the app's top row redraws around it (a Draw tab moves livediagram's menu card).
const CloseContext = createContext<() => void>(() => undefined);
/** Gives the section the drawer's Close (AppsDrawer wraps the section in it). */
export const PhoneAppsSectionClose = CloseContext.Provider;
/** Closes the Apps drawer the section is drawn in (a no-op outside one). */
export function useClosePhoneApps(): () => void {
  return useContext(CloseContext);
}

/** Clears the section between tests. */
export function resetPhoneAppsSectionForTests(): void {
  section = null;
  tell();
}
