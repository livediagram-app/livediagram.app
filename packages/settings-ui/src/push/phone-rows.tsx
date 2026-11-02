'use client';

// The Phone section of the Account section's Notifications (liveworkspace/docs/specs/003-accounts/push.md "Settings"):
// Turn On and the devices first, then the four switches, beside Email.
import type { SettingsRow } from '../model';
import type { PhoneHost } from './phone-host';
import { PHONE_KEYWORDS, PHONE_ROW_DESCRIPTION, PHONE_ROW_LABEL } from './phone-copy';
import { PhoneNotificationsRow } from './PhoneNotificationsRow';

export const PHONE_SECTION = 'Phone';

export function phoneRows(phone: PhoneHost, switches: readonly SettingsRow[]): SettingsRow[] {
  return [
    {
      kind: 'custom',
      key: 'phoneNotifications',
      label: PHONE_ROW_LABEL,
      description: PHONE_ROW_DESCRIPTION,
      keywords: PHONE_KEYWORDS,
      section: PHONE_SECTION,
      render: () => <PhoneNotificationsRow phone={phone} />,
    },
    ...switches,
  ];
}
