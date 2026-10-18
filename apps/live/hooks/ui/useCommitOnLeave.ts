'use client';

// An open text edit that commits on blur also commits when the page goes (lib/open-edit.ts): a reload or a closed
// tab fires no blur, so the unload flush asks the open edit to commit before it reads the tabs.
import { useEffect, useEffectEvent } from 'react';
import { registerOpenEdit } from '@/lib/open-edit';

/** While `open`, registers `commit` as the edit the unload flush commits first. */
export function useCommitOnLeave(open: boolean, commit: () => void): void {
  const onLeave = useEffectEvent(commit);
  useEffect(() => {
    if (!open) return;
    return registerOpenEdit(() => onLeave());
  }, [open]);
}
