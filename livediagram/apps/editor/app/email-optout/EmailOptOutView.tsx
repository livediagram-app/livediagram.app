'use client';

// The platform's unsubscribe page (@liveworkspace/automations-ui/EmailOptOutPage) over this editor's api: the
// canvas named by `d`, the address's token by `t`.
import { EmailOptOutPage } from '@liveworkspace/automations-ui/EmailOptOutPage';
import { sendEmailOptOut } from '@liveworkspace/automations-ui/email-optout';
import { API_BASE } from '@/lib/api/core';

const send = (documentId: string, token: string) => sendEmailOptOut(API_BASE, documentId, token);

export function EmailOptOutView() {
  return <EmailOptOutPage app="livediagram" item="canvas" param="d" send={send} />;
}
