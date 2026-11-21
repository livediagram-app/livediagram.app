'use client';

// The platform's unsubscribe page (@liveworkspace/automations-ui/EmailOptOutPage) over this editor's api: the
// design named by `d`, the address's token by `t`.
import { EmailOptOutPage } from '@liveworkspace/automations-ui/EmailOptOutPage';
import { sendEmailOptOut } from '@liveworkspace/automations-ui/email-optout';
import { API_BASE } from '@/lib/api/core';

const send = (designId: string, token: string) => sendEmailOptOut(API_BASE, designId, token);

export function EmailOptOutView() {
  return <EmailOptOutPage app="livedesign" item="design" param="d" send={send} />;
}
