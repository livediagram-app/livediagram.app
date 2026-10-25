import { useCallback, useMemo, useRef, useState } from 'react';
import type { AccessLevel } from '@liveplanner/api-schema';
import { participantTabChange, type Tab } from '@liveplanner/project';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';

// A Participant's session in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state"):
// its adder key, handed over with its room ticket; what it may do (`can`); and the one guard every element
// commit passes through, so a gesture the room would refuse never lands on screen. An Editor and a Viewer pass
// through untouched: an Editor's commit is never checked, and a Viewer's never reaches here.
// How often a Participant is told a gesture was held back: once for a burst (a drag, a held key), not per frame.
const HELD_BACK_NOTICE_MS = 4000;
export const HELD_BACK_NOTICE =
  'As a participant you can add and write, move stickies, and remove what you added.';

export function useParticipantSession(
  level: AccessLevel,
  notify?: (message: string) => void,
  // An Editor previewing as a Participant has no key from the room: its preview's own (useViewPreview).
  previewKey: string | null = null,
) {
  const [roomAdderKey, setAdderKey] = useState<string | null>(null);
  const adderKey = roomAdderKey ?? previewKey;
  const can = useMemo(() => resolveEditorCapabilities({ level, adderKey }), [level, adderKey]);
  const participating = level === 'participate';
  const lastNoticeRef = useRef(0);
  // The tab a commit would make, or null to drop it. Stamps the adder on what a Participant adds.
  const guardCommit = useCallback(
    (before: Tab, after: Tab): Tab | null => {
      if (!participating) return after;
      const allowed = participantTabChange(before, after, adderKey);
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
    [participating, adderKey, notify],
  );
  return { can, participating, adderKey, setAdderKey, guardCommit };
}
