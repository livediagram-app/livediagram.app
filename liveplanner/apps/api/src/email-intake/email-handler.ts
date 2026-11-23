// The worker's `email()` door (docs/specs/026-plan/email-to-board.md "Which mail is taken"; the platform's
// liveworkspace/docs/specs/003-accounts/inbound-email.md): Email Routing hands each message for the intake domain
// here. Steps 1 to 5 run in the worker, the rest in the plan's room. A refusal is the receiving server's answer
// (`setReject`), so the sender's own server tells them; nothing is ever sent from here.
import { readInboundMail, stripQuotedReply } from '@liveworkspace/email/inbound';
import { redactAddress } from '@liveworkspace/email';
import { planRoom } from '../plan-client';
import type { Env } from '../types';
import { codeOfRecipient, senderHash } from './intake-code';
import { findIntake } from './intake-directory';
import type { IntakeOutcome } from './intake-delivery';

// The largest message taken, as declared: under Email Routing's 25 MiB.
export const INTAKE_MESSAGE_MAX = 20 * 1024 * 1024;
// The Authentication-Results writers whose verdicts count: Email Routing's.
export const INTAKE_TRUSTED_AUTHSERV_IDS = ['mx.cloudflare.net'] as const;

/** The parts of a ForwardableEmailMessage this door reads. */
export type IntakeMessage = {
  from: string;
  to: string;
  rawSize: number;
  raw: ReadableStream<Uint8Array>;
  setReject(reason: string): void;
};

export const REJECTIONS = {
  no_address: 'No such address.',
  too_big: 'This message is too big for Email to Board.',
  sender_rate: 'Too many messages. Try again later.',
  refused_sender: "This board only takes mail from its plan's members.",
  unavailable: "Couldn't check the sender. Send it again later.",
  busy: 'Too many messages to this address. Try again later.',
  month_limit: 'This board is not taking email right now. Try again next month.',
  failed: "Couldn't make a card from this message. Send it again later.",
} as const;

type Reason = keyof typeof REJECTIONS;

function reject(message: IntakeMessage, reason: Reason): void {
  console.info('[email-intake] mail', {
    outcome: reason,
    sender: redactAddress(message.from),
  });
  message.setReject(REJECTIONS[reason]);
}

const OUTCOME_REASON: Partial<Record<IntakeOutcome, Reason>> = {
  gone: 'no_address',
  refused_sender: 'refused_sender',
  busy: 'busy',
  month_limit: 'month_limit',
  unavailable: 'unavailable',
  failed: 'failed',
};

/** One message for the intake domain, taken or refused. */
export async function handleIntakeEmail(message: IntakeMessage, env: Env): Promise<void> {
  const code = codeOfRecipient(message.to, env.EMAIL_INTAKE_DOMAIN);
  if (!code) return reject(message, 'no_address');
  if (message.rawSize > INTAKE_MESSAGE_MAX) return reject(message, 'too_big');
  if (env.FORM_RATE_LIMITER) {
    const ok = await env.FORM_RATE_LIMITER.limit({
      key: `mail:${(await senderHash(message.from)).slice(0, 32)}`,
    });
    if (!ok.success) return reject(message, 'sender_rate');
  }
  const entry = await findIntake(env, code);
  if (!entry) return reject(message, 'no_address');
  const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
  if (raw.byteLength > INTAKE_MESSAGE_MAX) return reject(message, 'too_big');
  const mail = readInboundMail(raw, {
    trustedAuthServIds: INTAKE_TRUSTED_AUTHSERV_IDS,
    envelopeFrom: message.from,
  });
  const room = planRoom(env, entry.planId);
  if (mail.authentication.verdict === 'fail' || !mail.from) {
    // Taken and thrown away: a forged sender is never answered, only counted.
    await room.emailIntake({ code, dropped: true });
    console.info('[email-intake] mail', {
      outcome: 'dropped',
      reason: mail.authentication.reason,
    });
    return;
  }
  const outcome = await room.emailIntake({
    code,
    sender: mail.from,
    subject: mail.subject,
    // What the sender wrote, without the message they replied to.
    text: stripQuotedReply(mail.text),
    attachments: mail.attachments,
  });
  const reason = OUTCOME_REASON[outcome];
  if (reason) return reject(message, reason);
  console.info('[email-intake] mail', { outcome });
}
