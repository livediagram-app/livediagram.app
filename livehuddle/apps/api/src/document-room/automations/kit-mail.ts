// A rule's Send Email through this app's email (blueprint automations.md "The kit": mail;
// docs/specs/014-identity/transactional-email.md): the platform's mailer (@liveworkspace/automations/room kitMail)
// over livehuddle's shell, sender and addresses. A person of the Space gets it only at their verified address
// and only while they have not turned assigned-action emails off (`notifyActionAssigned`, the switch for mail that
// tells someone about work on a Space): the same opt-out liveplanner's rule emails read. Null without the EMAIL
// binding, so the step says "Email isn't set up here".
import { kitMail as itemKitMail, type ItemMailer } from '@liveworkspace/automations/room';
import { appBaseUrl, emailEnabled, sendEmail } from '../../email/client';
import { automationEmailLook } from '../../email/email-shell';
import { notifyRecipients } from '../../liveworkspace/notify';
import type { DocumentEnv } from '../../types';
import { readDocumentMeta } from '../document-content';
import { documentUrl } from './kit-outline';

export function kitMail(env: DocumentEnv, documentId: string): ItemMailer | null {
  if (!emailEnabled(env)) return null;
  return itemKitMail({
    look: automationEmailLook(env),
    baseUrl: appBaseUrl(env),
    itemId: documentId,
    itemName: async () => (await readDocumentMeta(env, documentId))?.name ?? '',
    itemUrl: documentUrl(env, documentId),
    addressOf: async (personId) =>
      (await notifyRecipients(env, [personId], 'notifyActionAssigned')).get(personId),
    send: (email) => sendEmail(env, email),
  });
}
