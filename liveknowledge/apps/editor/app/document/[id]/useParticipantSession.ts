import { useMemo } from 'react';
import type { AccessLevel } from '@liveknowledge/api-schema';
import type { Tab } from '@liveknowledge/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';

// A session's rights in the editor (docs/specs/013-workspace/share-roles.md; blueprint "Editor state"): what it may
// do (`can`), and the commit guard the platform keeps for a text-only Participant. liveknowledge has no text-only
// Participant: its Participant is an Editor minus the Review Period, the Knowledgebase Style and automations
// (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles"), so its commits pass as an Editor's.
// `participating` is false for every level and `guardCommit` passes every commit; the room relays a Participant's
// changes as an Editor's (apps/api/src/room-op-gate.ts).

const passCommit = (_before: Tab, after: Tab): Tab | null => after;

export function useParticipantSession(level: AccessLevel) {
  const can = useMemo(() => resolveEditorCapabilities(level), [level]);
  return { can, participating: false, guardCommit: passCommit };
}
