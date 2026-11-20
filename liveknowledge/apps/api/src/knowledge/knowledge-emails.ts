// The knowledge emails' boundary (docs/specs/030-knowledgebase/verification.md "Reminders", ai-knowledge.md "Ask
// Both Owners", "Remind the Owners"). NOT BUILT: nothing owes this work yet, and a piece that reaches it is logged
// and dropped. What stands in the way is the platform's, not this room's: the shared notifier
// (@liveworkspace/index-app `createNotifier`) sends a fixed set of notices, each behind one of the account's
// notification settings, and it has none for a page's review, a conflict or a reminder. Sending these through
// `sendEmail` directly would skip the account's email settings, which the specs require they honour. When the
// notifier takes the three notices, this is where they are sent from: the alarm owes the work
// (`knowledge_work`, kinds `review-email`, `ask-owners`, `remind-owners`), a row an owner a day or a
// knowledgebase a week, so the batching the specs ask for is the row's key.
import type { DocumentEnv } from '../types';
import type { Work } from './knowledge-work';

export async function runKnowledgeEmail(
  _env: DocumentEnv,
  documentId: string,
  work: Work,
  _now: number,
): Promise<number | null> {
  console.warn('[knowledge] email not sent', { documentId, kind: work.kind, reason: 'not_built' });
  return null;
}
