// The shell every livediagram email is written into (docs/specs/014-identity/transactional-email.md): the shared look
// (@liveworkspace/email/layout) in livediagram's brand, the footer of an opt-out notification, and where every opt-out
// category is turned off. Beside the templates (templates.ts), which hold the words.
import {
  createEmailLayout,
  notificationSettingsUrl,
  type EmailSection,
} from '@liveworkspace/email/layout';
import type { ItemEmailLook } from '@liveworkspace/automations/room';
import type { Env } from '../types';
import { appBaseUrl } from './client';

// The shared look (@liveworkspace/email/layout), in livediagram's brand.
const layout = createEmailLayout({
  brand: '#0ea5e9',
  wordmarkAccent: '#0284c7',
  bandGradient: 'linear-gradient(90deg,#38bdf8 0%,#0ea5e9 45%,#1d4ed8 100%)',
  canvas: '#f0f9ff',
  // `pnpm icons:brand` writes it into the marketing app's public/email/. 64px, 2x the slot.
  logoPath: '/email/livediagram-mark-64.png',
  wordmarkTail: 'diagram',
  tagline: 'Diagram, draw and run workshops together, live. Free and open source.',
  accountFooter:
    'You’re receiving this because you have a livediagram account. The editor is free and open source.',
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
// (@liveworkspace/automations/room email.ts) with livediagram's words, which call a document a canvas.
export function automationEmailLook(env: Env): ItemEmailLook {
  return {
    shell: (section) => shell(env, section),
    manageNotificationsFooter: (reason) => manageNotificationsFooter(env, reason),
    profileUrl: profilePath(env),
    noun: 'canvas',
    product: 'livediagram',
    linkColour: '#0ea5e9',
  };
}
