'use client';

import type { ReactNode } from 'react';
import { lucideMail } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';

// Notifications says how each one reaches you: an envelope beside every switch under Email and a phone beside every
// switch under Phone (liveworkspace/docs/specs/010-site/site.md "Settings", Notifications). Keyed on the section, so
// the email switches each app folds in (a comment on your plan, say) carry it too.

export const EMAIL_SECTION = 'Email';
// Defined here, not beside the phone rows, so a plain switch's cell carries none of the Phone section's code.
export const PHONE_SECTION = 'Phone';

const MailGlyph = lucideGlyph(lucideMail, 16);

// A phone, not a handset: these arrive on the person's phone as notifications, not calls.
function PhoneGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="4.25" y="1.5" width="7.5" height="13" rx="1.75" />
      <path d="M7.25 12.25h1.5" />
    </svg>
  );
}

/** The channel mark for a row in `section`, or null for any other section. */
export function channelGlyph(section: string | undefined): ReactNode {
  if (section !== EMAIL_SECTION && section !== PHONE_SECTION) return null;
  return (
    <span
      aria-hidden
      data-settings-channel={section === EMAIL_SECTION ? 'email' : 'phone'}
      className="flex size-4 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400"
    >
      {section === EMAIL_SECTION ? <MailGlyph /> : <PhoneGlyph />}
    </span>
  );
}
