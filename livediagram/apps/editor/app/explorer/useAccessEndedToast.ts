'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/ui/useToast';
import { ACCESS_REVOKED_MESSAGE, takeAccessEnded } from '@/lib/access-notice';

// A revoked pass sends its sessions here (docs/specs/013-workspace/share-roles.md "Share links"): say so, once, in the
// warning tone (always shown, as losing access is not a notification the In-Editor Notifications setting can mute).
export function useAccessEndedToast(): void {
  const toast = useToast();
  useEffect(() => {
    if (takeAccessEnded() === 'revoked') toast.warning(ACCESS_REVOKED_MESSAGE);
  }, [toast]);
}
