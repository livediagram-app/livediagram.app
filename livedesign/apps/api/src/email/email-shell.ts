// The shell every livedesign email is written into (docs/specs/014-identity/transactional-email.md): the shared
// look (@liveworkspace/email/layout) in livedesign's brand, the footer of an opt-out notification, and where every
// opt-out category is turned off. Beside the templates (templates.ts), which hold the words.
import type { ItemEmailLook } from '@liveworkspace/automations/room';
import {
  createEmailLayout,
  notificationSettingsUrl,
  type EmailSection,
} from '@liveworkspace/email/layout';
import type { Env } from '../types';
import { appBaseUrl } from './client';

// brand-700: it carries the button's white text and the links' text, and white on rose-500 is 2.2:1 where
// brand-700 clears AA at 5.9:1.
const BRAND = '#be123c';

// The shared look (@liveworkspace/email/layout), in livedesign's brand.
const layout = createEmailLayout({
  brand: BRAND,
  wordmarkAccent: BRAND,
  bandGradient: 'linear-gradient(90deg,#fb7185 0%,#f43f5e 45%,#be185d 100%)',
  canvas: '#fff1f2',
  // `pnpm icons:brand` writes it into the marketing app's public/email/. 64px, 2x the slot.
  logoPath: '/email/livedesign-mark-64.png',
  wordmarkTail: 'design',
  tagline: 'Design logos and wireframes together, live. Free and open source.',
  accountFooter:
    'You’re receiving this because you have a livedesign account. The editor is free and open source.',
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
// (@liveworkspace/automations/room email.ts) with livedesign's words.
export function automationEmailLook(env: Env): ItemEmailLook {
  return {
    shell: (section) => shell(env, section),
    manageNotificationsFooter: (reason) => manageNotificationsFooter(env, reason),
    profileUrl: profilePath(env),
    noun: 'design',
    product: 'livedesign',
    linkColour: BRAND,
  };
}
