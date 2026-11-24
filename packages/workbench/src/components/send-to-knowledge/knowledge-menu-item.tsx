'use client';

// Send to Knowledge Base's row in an element's Resources (each app's docs/specs/013-workspace/send-to-knowledge.md
// "What it sends"): right after Send to Plan, while this session may send. "On" once a section was written from it,
// its line then saying where. The menus build their rows on open, so reading the store here is current.
import type { ResourceOption } from '../palette/element-resources';
import { elementKnowledgeSends, sentPageWords } from './knowledge-send-store';
import { KnowledgeLogo } from './SendToKnowledgeButton';
import {
  canSendKnowledgeHere,
  sendToKnowledge,
  type KnowledgeCapture,
} from './send-to-knowledge-entry';

/** The element's Send to Knowledge Base option, or null while this session cannot send. */
export function elementKnowledgeItem(
  elementId: string,
  capture: () => KnowledgeCapture | null,
): ResourceOption | null {
  if (!canSendKnowledgeHere()) return null;
  const sent = elementKnowledgeSends(elementId)[0];
  return {
    key: 'send-to-knowledge',
    // The tile's title, short enough to fit it whole ("Send to Knowledge Base" was cut); the label keeps the verb.
    name: 'Knowledge Base',
    detail: sent ? `Sent: ${sentPageWords(sent)}` : 'A section about it in liveknowledge',
    state: sent ? `Sent: ${sentPageWords(sent)}` : 'Not sent yet',
    label: 'Send to Knowledge Base…',
    icon: <KnowledgeLogo size={16} />,
    on: !!sent,
    run: () => sendToKnowledge(capture()),
  };
}
