// Send to Diagram's entries (liveworkspace/docs/specs/004-index/send-to-diagram.md; each app's
// 013-workspace/send-to-diagram.md): a text toolbar, a page toolbar or a reader's pill asks for the picker with the
// words, and the editor's one SendToPlanHost opens it when the app gave it a drafter. A module-level relay, as Send to
// Plan's: the entries and the host sit far apart in the tree, and one editor runs per page.
import {
  DIAGRAM_SEND_LABEL_MAX,
  DIAGRAM_SEND_WORDS_MAX,
  type DiagramSendGraph,
  type DiagramSendKind,
} from '@liveworkspace/index-client';
import { sendSourceId } from '../send-to-plan/send-store';
import { sendHere } from '../send-to-plan/send-to-plan-entry';

/** The words to draw and where they sit. */
export type DiagramSendRequest = {
  words: string;
  tabId: string | null;
  elementId: string | null;
  // The place's name (a page's title), for the diagram's name and its caption.
  label: string;
};

/** What the app's api answers for a draft: the graph, or throws an Error whose message the dialog shows. */
export type DiagramDrafter = (ask: {
  tabId: string | null;
  words: string;
  kind: DiagramSendKind;
}) => Promise<DiagramSendGraph>;

const listeners = new Set<(request: DiagramSendRequest) => void>();
let drafter: DiagramDrafter | null = null;

/** The host's word on whether this editor can draft diagrams (its app gave a drafter); null when it closes. */
export function setDiagramDrafter(next: DiagramDrafter | null): void {
  drafter = next;
}

/** Whether an entry should offer Send to Diagram now: the host is up, may send, and has a drafter. */
export function canSendDiagramHere(): boolean {
  return drafter !== null && sendHere() !== null && sendSourceId() !== null;
}

/** Opens the picker for these words. Nothing happens with none, or when this session cannot send. */
export function sendWordsToDiagram(input: {
  elementId: string | null;
  text: string;
  label?: string;
  // Another tab than the one shown.
  onTab?: string;
}): void {
  const here = sendHere();
  const words = input.text.trim().slice(0, DIAGRAM_SEND_WORDS_MAX);
  if (!here || !sendSourceId() || !drafter || !words) return;
  const request: DiagramSendRequest = {
    words,
    tabId: input.onTab ?? here.tabId,
    elementId: input.elementId,
    label: (input.label ?? '').trim().slice(0, DIAGRAM_SEND_LABEL_MAX),
  };
  for (const l of [...listeners]) l(request);
}

/** The host's subscription; answers the unsubscribe. */
export function onSendToDiagram(listener: (request: DiagramSendRequest) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The drafter the host was given, for its dialog. */
export const currentDrafter = (): DiagramDrafter | null => drafter;
