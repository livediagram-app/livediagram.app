import { useCallback, useMemo, useRef } from 'react';
import type { AccessLevel } from '@livedocuments/api-schema';
import { participantTabChange, type Tab } from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';

// A Participant's session in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state"): what
// it may do (`can`), and the one guard every commit passes through, so a change the room would refuse never lands
// on screen. A Participant edits text only. An Editor and a Viewer pass through untouched: an Editor's commit is
// never checked, and a Viewer's never reaches here.
// How often a Participant is told a gesture was held back: once for a burst (a drag, a held key), not per frame.
const HELD_BACK_NOTICE_MS = 4000;
export const HELD_BACK_NOTICE = 'As a participant you can edit text and comment.';

export function useParticipantSession(level: AccessLevel, notify?: (message: string) => void) {
  const can = useMemo(() => resolveEditorCapabilities(level), [level]);
  const participating = level === 'participate';
  const lastNoticeRef = useRef(0);
  // The tab a commit would make, or null to drop it.
  const guardCommit = useCallback(
    (before: Tab, after: Tab): Tab | null => {
      if (!participating) return after;
      const allowed = participantTabChange(before, after);
      if (!allowed) {
        debugLog('[participant] change held back', before.id);
        const now = Date.now();
        if (now - lastNoticeRef.current > HELD_BACK_NOTICE_MS) {
          lastNoticeRef.current = now;
          notify?.(HELD_BACK_NOTICE);
        }
      }
      return allowed;
    },
    [participating, notify],
  );
  return { can, participating, guardCommit };
}
