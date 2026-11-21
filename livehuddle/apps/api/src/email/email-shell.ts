// The shell every livehuddle email is written into (docs/specs/014-identity/transactional-email.md): the shared look
// (@liveworkspace/email/layout) in livehuddle's brand, the footer of an opt-out notification, and where every opt-out
// category is turned off. Beside the templates (templates.ts), which hold the words.
import {
  createEmailLayout,
  notificationSettingsUrl,
  type EmailSection,
} from '@liveworkspace/email/layout';
import type { ItemEmailLook } from '@liveworkspace/automations/room';
import type { Env } from '../types';
import { appBaseUrl } from './client';

// The brand's links and button: brand-700, since white on emerald-500 is 2.5:1 where brand-700 clears AA at 5.5:1.
const BRAND = '#047857';

// The shared look (@liveworkspace/email/layout), in livehuddle's brand.
const layout = createEmailLayout({
  brand: BRAND,
  wordmarkAccent: BRAND,
  bandGradient: 'linear-gradient(90deg,#34d399 0%,#10b981 45%,#0f766e 100%)',
  canvas: '#ecfdf5',
  // `pnpm icons:brand` writes it into the marketing app's public/email/. 64px, 2x the slot.
  logoPath: '/email/livehuddle-mark-64.png',
  wordmarkTail: 'huddle',
  tagline: 'Meet up in shared Spaces, live. Free and open source.',
  accountFooter:
    'You’re receiving this because you have a livehuddle account. The editor is free and open source.',
});

// docs/specs/014-identity/transactional-email.md: footer for an opt-out notification email, the reason plus a link to
// the settings where the recipient can turn the category off in one click.
export function manageNotificationsFooter(env: Env, reason: string): string {
  return layout.manageNotificationsFooter(appBaseUrl(env), reason);
}

// Where every opt-out category can be turned off, for the footer link and the List-Unsubscribe header.
export function profilePath(env: Env): string {
  return notificationSettingsUrl(appBaseUrl(env));
}

export function shell(env: Env, section: EmailSection): string {
  return layout.shell(appBaseUrl(env), section);
}

// A rule's Send Email (docs/specs/013-workspace/automations.md) in this shell: the platform's two emails
// (@liveworkspace/automations/room email.ts) with livehuddle's words, which call its item a Space.
export function automationEmailLook(env: Env): ItemEmailLook {
  return {
    shell: (section) => shell(env, section),
    manageNotificationsFooter: (reason) => manageNotificationsFooter(env, reason),
    profileUrl: profilePath(env),
    noun: 'Space',
    product: 'livehuddle',
    linkColour: BRAND,
  };
}
