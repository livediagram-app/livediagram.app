import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AccessLevel } from '@livedocuments/api-schema';
import { participantTabChange, type Tab } from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { suggestAuthorKey, useSuggestOnly } from '@/lib/article/article-suggest-store';

// A Participant's session in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state"): what
// it may do (`can`), and the one guard every commit passes through, so a change the room would refuse never lands
// on screen. A Participant edits text only. An Editor and a Viewer pass through untouched: an Editor's commit is
// never checked, and a Viewer's never reaches here.
// How often a Participant is told a gesture was held back: once for a burst (a drag, a held key), not per frame.
const HELD_BACK_NOTICE_MS = 4000;
export const HELD_BACK_NOTICE = 'As a participant you can edit text and comment.';

export function useParticipantSession(level: AccessLevel, notify?: (message: string) => void) {
  // On Suggest Only (docs/specs/007-editor/suggestions.md "Suggest Only") the writing changes only as suggestions in
  // this session's name, and a comment on words may add its margin marker: the room holds the same rule.
  const suggestOnly = useSuggestOnly() && level === 'participate';
  const can = useMemo(
    () => resolveEditorCapabilities(level, { suggestOnly }),
    [level, suggestOnly],
  );
  const participating = level === 'participate';
  // A Viewer reads the rejected view (docs/specs/007-editor/suggestions.md "Everywhere a page goes"): no suggestion
  // shows (article-pages.css).
  useEffect(() => {
    if (level !== 'view') return;
    const root = document.documentElement;
    root.dataset.suggestionsHidden = '';
    return () => {
      delete root.dataset.suggestionsHidden;
    };
  }, [level]);
  const lastNoticeRef = useRef(0);
  // The tab a commit would make, or null to drop it.
  const guardCommit = useCallback(
    (before: Tab, after: Tab): Tab | null => {
      if (!participating) return after;
      const by = suggestOnly ? suggestAuthorKey() : null;
      const allowed = participantTabChange(
        before,
        after,
        by ? { suggestBy: by, marginComment: true } : {},
      );
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
    [participating, suggestOnly, notify],
  );
  return { can, participating, guardCommit };
}
