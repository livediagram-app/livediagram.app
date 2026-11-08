'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SettingsAppId } from './store';

// Which app's side the Settings panel shows (liveworkspace/docs/specs/010-site/site.md "Settings", the header switch):
// the app it was opened for while the switch is on This App, null on All and on liveworkspace.app opened from no app.
// A panel drawn in a custom row (Webhooks) reads it to keep to that app's things.
const ShownApp = createContext<SettingsAppId | null>(null);

export function SettingsShownAppProvider({
  value,
  children,
}: {
  value: SettingsAppId | null;
  children: ReactNode;
}) {
  return <ShownApp.Provider value={value}>{children}</ShownApp.Provider>;
}

/** The app the panel is kept to, or null for every app. */
export function useSettingsShownApp(): SettingsAppId | null {
  return useContext(ShownApp);
}
