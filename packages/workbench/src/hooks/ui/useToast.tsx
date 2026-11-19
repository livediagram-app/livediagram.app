'use client';

// The editors' toasts: the one shared toast (@liveworkspace/ui/toast,
// liveworkspace/docs/specs/016-notifications/toasts.md), bound to the In-Editor Notifications setting
// (docs/specs/007-editor/user-preferences.md), read fresh per push (a cheap synchronous localStorage read) so a Settings
// flip applies at once. Each editor's notification list is its document's (the page's path).
import type { ReactNode } from 'react';
import { ToastProvider as SharedToastProvider } from '@liveworkspace/ui/toast';
import { workbench } from '../../bindings';

export {
  useToast,
  type ToastAction,
  type ToastActionSpec,
  type ToastApi,
  type ToastOffer,
  type ToastOptions,
  type ToastTone,
} from '@liveworkspace/ui/toast';

const quieted = () => workbench.readPreferences().notificationsEnabled === false;

export function ToastProvider({ children }: { children: ReactNode }) {
  return <SharedToastProvider quiet={quieted}>{children}</SharedToastProvider>;
}
