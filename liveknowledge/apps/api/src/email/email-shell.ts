// A rule's Send Email in liveknowledge's shell (docs/specs/013-workspace/automations.md; docs/specs/014-identity/
// transactional-email.md): the platform's two emails (@liveworkspace/automations/room email.ts) in the look every
// liveknowledge email shares (brand-layout.ts), with this product's words.
import type { ItemEmailLook } from '@liveworkspace/automations/room';
import type { Env } from '../types';
import { EMAIL_BRAND, manageNotificationsFooter, profilePath, shell } from './brand-layout';

export function automationEmailLook(env: Env): ItemEmailLook {
  return {
    shell: (section) => shell(env, section),
    manageNotificationsFooter: (reason) => manageNotificationsFooter(env, reason),
    profileUrl: profilePath(env),
    noun: 'knowledgebase',
    product: 'liveknowledge',
    linkColour: EMAIL_BRAND,
  };
}
