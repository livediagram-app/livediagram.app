// What an event in an item's History says beyond its reason line (livediagram/docs/specs/013-workspace/history.md
// "The dialog"): who did it, the detail ("Was “Q3”", "To Launches", the share level), and a comment's or action's
// words to quote beneath.

import type { ItemEvent } from '@liveworkspace/index-client';
import { quoted } from '../quoted';
import { SHARE_LEVEL_WORDS } from './share-levels';

/** Who did it, as the reader should hear it. The index keeps no names: an app's report may carry one. */
export function actorWords(event: ItemEvent, viewerId: string | null): string {
  if (event.actorId && viewerId && event.actorId === viewerId) return 'you';
  if (event.actorName) return event.actorName;
  if (event.actorId === 'deleted') return 'a closed account';
  // Someone who came in by a share link: named when they have an account, else a visitor.
  if (event.type === 'opened_by_visitor' || event.type === 'copied_by_visitor') return 'a visitor';
  return 'a teammate';
}

export type EventWords = {
  // The detail after who did it ("Was “Q3”", "To Launches"), or null for none.
  detail: string | null;
  // Free text quoted beneath: a comment's words, an action's name.
  quote: string | null;
};

/** An event's detail and quote. `teamName` names the team a move went to when it went to no folder. */
export function eventWords(
  event: ItemEvent,
  viewerId: string | null,
  teamName: (id: string | null) => string | null,
): EventWords {
  const detail = event.detail ?? {};
  switch (event.type) {
    case 'renamed':
      return { detail: detail.from ? `Was ${quoted(detail.from)}` : null, quote: null };
    case 'moved': {
      const place = detail.folderName ?? (detail.teamId ? teamName(detail.teamId) : 'My Work');
      return { detail: place ? `To ${place}` : null, quote: null };
    }
    case 'shared':
      return { detail: SHARE_LEVEL_WORDS[detail.level ?? ''] ?? 'Shared by link', quote: null };
    case 'commented': {
      const count = Number(detail.count ?? '1') || 1;
      return { detail: count > 1 ? `${count} comments` : null, quote: detail.text ?? null };
    }
    case 'comment_resolved':
      return { detail: null, quote: detail.text ?? null };
    case 'action_assigned':
      return {
        detail: `To ${
          detail.assigneeId && detail.assigneeId === viewerId
            ? 'you'
            : (detail.assigneeName ?? 'a teammate')
        }`,
        quote: detail.action ?? null,
      };
    case 'action_done':
      return { detail: null, quote: detail.action ?? null };
    default:
      return { detail: null, quote: null };
  }
}
