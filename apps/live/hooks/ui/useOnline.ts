import { useSyncExternalStore } from 'react';
import { getOnline, getOnlineServer, subscribeOnline } from '@/lib/online-status';

// True unless the browser says it is offline (docs/specs/007-editor/load-recovery.md "Offline").
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnline, getOnlineServer);
}
