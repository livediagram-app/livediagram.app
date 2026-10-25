import { clearRepairableStorage, type RepairResult } from '@liveworkspace/ui';
import { isRepairClearable } from './kept-keys';

// The repair itself (docs/specs/007-editor/load-recovery.md "Repairing a browser"): @liveworkspace/ui's walk
// over local and session storage, clearing what this product's kept-keys say may go.

/** Clear every clearable key from this origin's local and session storage. */
export function repairBrowserStorage(
  win: Pick<Window, 'localStorage' | 'sessionStorage'> = window,
): RepairResult {
  return clearRepairableStorage(isRepairClearable, win);
}
