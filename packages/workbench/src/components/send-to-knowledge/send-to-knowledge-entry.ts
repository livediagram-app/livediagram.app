// Send to Knowledge Base's entries (liveworkspace/docs/specs/004-index/send-to-knowledge.md; each app's
// docs/specs/013-workspace/send-to-knowledge.md): a selection's toolbar or an element's menu asks for the picker with
// what is selected, and the editor's one SendToPlanHost opens it. A module-level relay, as Send to Plan's is: the
// menus and the host sit far apart in the tree, and one editor runs per page. An app offers it by handing the host a
// summariser (its own AI route) and, here, a way to capture its selection; without both no entry shows.
import type { KnowledgeSendPicture, KnowledgeSendSelection } from '@liveworkspace/index-client';

/** What the selection's capture gives: the items as the model and the fallback read them, and its picture. */
export type KnowledgeCapture = {
  tabId: string;
  // The selected elements (a frame's contents included), the first the link back opens at.
  elementIds: string[];
  selection: KnowledgeSendSelection;
  // The heading the picker starts from: the first frame's or label's words.
  heading: string;
  // Drawn when the picker opens; null for a selection too big to draw within the platform's size.
  picture: () => Promise<KnowledgeSendPicture | null>;
};

/** What the app's summary route answered. */
export type KnowledgeSummaryAnswer =
  | { ok: true; markdown: string }
  | {
      ok: false;
      error: string;
      message: string;
      // With Pro on and the month used: whose month it is, for the limit notice.
      limit?: 'aiCreditsPerMonth';
      owner?: string;
      used?: number;
      max?: number;
    };

/** The app's summary route (`POST <api>/documents/:id/knowledge-summary`). */
export type KnowledgeSummariser = (ask: {
  tabId: string;
  selection: KnowledgeSendSelection;
  focus: string;
}) => Promise<KnowledgeSummaryAnswer>;

const listeners = new Set<(capture: KnowledgeCapture) => void>();
let summariser: KnowledgeSummariser | null = null;

/** The host's word that this editor may send to a knowledgebase now (an app with a summariser, a session that may
 *  send); null when it closes. */
export function setKnowledgeSummariser(next: KnowledgeSummariser | null): void {
  summariser = next;
}

/** The summariser while the host offers Send to Knowledge Base, else null. */
export const knowledgeSummariser = (): KnowledgeSummariser | null => summariser;

/** Whether an entry should offer Send to Knowledge Base now. */
export const canSendKnowledgeHere = (): boolean => summariser !== null && listeners.size > 0;

/** Opens the picker for this selection. Nothing happens while no host offers it, or with nothing selected. */
export function sendToKnowledge(capture: KnowledgeCapture | null): void {
  if (!capture || capture.elementIds.length === 0 || !summariser) return;
  for (const l of [...listeners]) l(capture);
}

/** The host's subscription; answers the unsubscribe. */
export function onSendToKnowledge(listener: (capture: KnowledgeCapture) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
