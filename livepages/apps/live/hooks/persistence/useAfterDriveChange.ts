'use client';

// Re-read a view when a change made in Google Drive has been applied here
// (docs/specs/022-drive-mirror/drive-mirror.md, "Other views follow"). The same
// after-write beat as the Timeline's, taking only the signals the Drive mirror
// raises (in whichever tab ran the check; the others hear it on the tab channel).

import { useAfterApiWrite } from './useAfterApiWrite';

const fromDrive = (signal: { drive?: true }) => signal.drive === true;

export function useAfterDriveChange(onChange: () => void, enabled = true): void {
  useAfterApiWrite(() => onChange(), { enabled, filter: fromDrive });
}
