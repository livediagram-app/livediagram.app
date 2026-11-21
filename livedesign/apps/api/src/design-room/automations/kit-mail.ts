// A rule's Send Email through this app's email (blueprint automations.md "The kit": mail;
// docs/specs/014-identity/transactional-email.md): the platform's mailer (@liveworkspace/automations/room kitMail)
// over livedesign's shell, sender and addresses. A person of the design gets it only at their verified address
// and only while they have not turned assigned-action emails off (`notifyActionAssigned`, the switch for mail that
// tells someone about work on a design), as livediagram's rule emails read. Null without the EMAIL binding, so the
// step says "Email isn't set up here".
import { kitMail as itemKitMail, type ItemMailer } from '@liveworkspace/automations/room';
import { appBaseUrl, emailEnabled, sendEmail } from '../../email/client';
import { automationEmailLook } from '../../email/email-shell';
import { notifyRecipients } from '../../accounts/notify';
import type { DesignEnv } from '../../types';
import { readDesignMeta } from '../design-content';
import { designUrl } from './kit-outline';

export function kitMail(env: DesignEnv, designId: string): ItemMailer | null {
  if (!emailEnabled(env)) return null;
  return itemKitMail({
    look: automationEmailLook(env),
    baseUrl: appBaseUrl(env),
    itemId: designId,
    itemName: async () => (await readDesignMeta(env, designId))?.name ?? '',
    itemUrl: designUrl(env, designId),
    addressOf: async (personId) =>
      (await notifyRecipients(env, [personId], 'notifyActionAssigned')).get(personId),
    send: (email) => sendEmail(env, email),
  });
}
