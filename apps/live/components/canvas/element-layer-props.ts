import { useMemo, useState } from 'react';
import type { Participant } from '@/lib/identity';
import { useStableHandlers } from '@/hooks/ui/useStableHandlers';
import type { CollabApi } from './collab/CollabFaceRouter';

// Identity-stable per-element props for the element layer (docs/specs/008-canvas/canvas-performance.md):
// an element view re-renders only for its own changes, so what the layer builds per element must keep
// its identity across editor renders.

// One object per id, built on first ask and handed back after. The builder closes over stable
// handlers (useStableHandlers), so an entry never goes stale; a new cache is made only when the
// handlers' presence changes.
export function idBound<T>(make: (id: string) => T): (id: string) => T {
  const cache = new Map<string, T>();
  return (id) => {
    let hit = cache.get(id);
    if (hit === undefined) {
      hit = make(id);
      cache.set(id, hit);
    }
    return hit;
  };
}

// Every handler the collaboration faces call. Checked against CollabApi below, so a new handler on
// the API that is missing here fails the build rather than slipping past the wrappers.
const COLLAB_HANDLERS = [
  'respond',
  'setResponsesRevealed',
  'chooseEstimateScale',
  'clearResponses',
  'addIdea',
  'revealIdeas',
  'clearIdeas',
  'scatterIdeas',
  'pressAgendaItem',
  'takeRoll',
  'addQaNote',
  'voteQaNote',
  'discussQaNote',
  'closeQaNote',
  'reopenQaNote',
  'removeQaNote',
  'clearQaBoard',
  'answerQuiz',
  'startQuiz',
  'lockQuiz',
  'revealQuiz',
  'resetQuiz',
  'saveQuiz',
] as const satisfies readonly CollabHandlerKey[];

type CollabHandlerKey = {
  [K in keyof CollabApi]-?: NonNullable<CollabApi[K]> extends (...args: never[]) => unknown
    ? K
    : never;
}[keyof CollabApi];
type CollabHandlers = Pick<CollabApi, CollabHandlerKey>;
// Fails to compile when CollabApi gains a handler COLLAB_HANDLERS does not list.
const ALL_HANDLERS_LISTED: Exclude<CollabHandlerKey, (typeof COLLAB_HANDLERS)[number]> extends never
  ? true
  : never = true;
void ALL_HANDLERS_LISTED;

// What a collaboration face shows of a participant: the roster is held while these are unchanged, so
// presence churn (activity timestamps) does not re-render every element.
const rosterSignature = (participants: readonly Participant[]) =>
  participants
    .map((p) => [p.id, p.key, p.name, p.color, p.status, p.role, p.picture].join('\u0001'))
    .join('\u0002');

// The collab bag the editor mints per render, held while nothing a face shows changes: handlers
// through stable wrappers (presence kept), the roster by what faces read, the rest by value.
export function useStableCollab(collab: CollabApi): CollabApi {
  const handlers = useStableHandlers(
    Object.fromEntries(COLLAB_HANDLERS.map((k) => [k, collab[k]])) as CollabHandlers,
  );
  const signature = rosterSignature(collab.participants);
  const [roster, setRoster] = useState({ signature, participants: collab.participants });
  if (roster.signature !== signature) setRoster({ signature, participants: collab.participants });
  const participants = roster.signature === signature ? roster.participants : collab.participants;
  const { selfKey, tabTimer, selfOwnerId, selfName, canArrange } = collab;
  return useMemo(
    () => ({ ...handlers, selfKey, participants, tabTimer, selfOwnerId, selfName, canArrange }),
    [handlers, selfKey, participants, tabTimer, selfOwnerId, selfName, canArrange],
  );
}
