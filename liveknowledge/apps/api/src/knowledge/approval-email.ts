// Page Rejected (docs/specs/030-knowledgebase/approval.md "Email"): a rejected page's owner is told who rejected it
// and why, through the platform's notifier under their Knowledgebase Reviews switch, as the review emails are
// (knowledge-emails.ts). Only an owner who can still open the knowledgebase, never the person who rejected it, and
// within the knowledgebase's daily ceiling. A failure is logged and never fails the rejection.
import { emailEnabled } from '../email/client';
import { pageRejectedEmail } from '../email/knowledge-templates';
import { notifyKnowledgeReviews } from '../email/notifications';
import { getParticipant } from '../person/profiles';
import type { DocumentDTO, DocumentEnv } from '../types';
import { reserveEmails } from './email-marks';
import { ownersWhoReach } from './knowledge-emails';

export async function sendPageRejected(
  env: DocumentEnv,
  document: DocumentDTO,
  page: { tab: string; title: string; owner: string | undefined },
  rejectedBy: string,
  note: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!page.owner || page.owner === rejectedBy || !emailEnabled(env)) return false;
  try {
    const [reach] = await ownersWhoReach(env, document, [page.owner]);
    if (!reach || (await reserveEmails(env, 1, now)) < 1) return false;
    const who = (await getParticipant(env, rejectedBy))?.name ?? '';
    const email = pageRejectedEmail(env, document, page, who, note);
    const sent = await notifyKnowledgeReviews(env, new Map([[reach, email]]));
    return sent.includes(reach);
  } catch (err) {
    console.warn('[knowledge] page rejected email not sent', {
      documentId: document.id,
      tabId: page.tab,
      error: String(err),
    });
    return false;
  }
}
