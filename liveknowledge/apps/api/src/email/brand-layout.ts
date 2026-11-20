// liveknowledge's email look and the parts every template shares (docs/specs/014-identity/transactional-email.md):
// the shared layout (@liveworkspace/email/layout) in this product's brand, the shell bound to the app's address, and
// the footer and link an opt-out notification carries. One place, so templates.ts and knowledge-templates.ts draw
// the same email.
import {
  createEmailLayout,
  notificationSettingsUrl,
  type EmailSection,
} from '@liveworkspace/email/layout';
import type { Env } from '../types';
import { appBaseUrl } from './client';

/** brand-700: it carries the button's white text and the links' text (7.4:1 on white). */
export const EMAIL_BRAND = '#3f6212';

// The shared look (@liveworkspace/email/layout), in liveknowledge's brand.
const layout = createEmailLayout({
  // brand-700: it carries the button's white text and the links' text, and white on
  // lime-500 is 2:1 where brand-700 clears AA at 7.4:1.
  brand: EMAIL_BRAND,
  wordmarkAccent: EMAIL_BRAND,
  bandGradient: 'linear-gradient(90deg,#a3e635 0%,#84cc16 45%,#4d7c0f 100%)',
  canvas: '#f7fee7',
  // `pnpm icons:brand` writes it into the marketing app's public/email/. 64px, 2x the slot.
  logoPath: '/email/liveknowledge-mark-64.png',
  wordmarkTail: 'knowledge',
  tagline: 'A team knowledgebase, for people and for AI. Free and open source.',
  accountFooter:
    'You’re receiving this because you have a liveknowledge account. The editor is free and open source.',
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
