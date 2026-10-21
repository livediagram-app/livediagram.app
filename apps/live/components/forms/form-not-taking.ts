// Why a published form takes no responses now (docs/specs/030-forms/forms.md "Hearing about responses", "Not Taking
// Responses"), for the status bar's red warning: the first that applies, with what it says and where it sends the
// Editor to fix it.
import type { DestinationProblem } from '@liveplanner/forms';
import type { FormLinkResponse } from '@liveplanner/api-schema';

export type FormNotTakingReason =
  'suspended' | 'paused' | 'switched_off' | 'closes_at' | 'limit' | 'full';

// Where the warning sends the Editor: Share Form, the cog's Responses Go To or Settings, or the responses' tab.
export type FormNotTakingFix = 'share' | 'destination' | 'settings' | 'responses';

export const FORM_NOT_TAKING: Record<
  FormNotTakingReason,
  { text: string; fix: FormNotTakingFix; telemetry: string }
> = {
  suspended: {
    text: 'Its link was suspended after reports. Share Form publishes a new one.',
    fix: 'share',
    telemetry: 'NotTakingSuspended',
  },
  paused: {
    text: 'Responses have nowhere to go. Choose where they go to take them again.',
    fix: 'destination',
    telemetry: 'NotTakingPaused',
  },
  switched_off: {
    text: 'Accepting Responses is off, so the link shows your closed message. Turn it on in Share Form.',
    fix: 'share',
    telemetry: 'NotTakingSwitchedOff',
  },
  closes_at: {
    text: 'Its Close On time has passed. Change it in Settings to take responses again.',
    fix: 'settings',
    telemetry: 'NotTakingClosesAt',
  },
  limit: {
    text: 'It reached its Response Limit. Raise it in Settings to take responses again.',
    fix: 'settings',
    telemetry: 'NotTakingLimit',
  },
  full: {
    text: 'This document holds as many cards as it can. Remove some to take responses again.',
    fix: 'responses',
    telemetry: 'NotTakingFull',
  },
};

/**
 * Why a form that has been published takes no responses, or null while it takes them (or was never published, or
 * is a Draft with no server). Suspension first (the link is gone), then a broken destination (reopening waits on
 * it), the switch, the Close On and Response Limit, and a full document.
 */
export function formNotTakingReason(input: {
  link: FormLinkResponse | null;
  problem: DestinationProblem | null;
  closedBy: 'closes_at' | 'limit' | null;
  full: boolean;
}): FormNotTakingReason | null {
  const { link, problem, closedBy, full } = input;
  const live = link?.link ?? null;
  if (!live) return link?.suspendedAt ? 'suspended' : null;
  if (problem) return 'paused';
  if (!live.open) return 'switched_off';
  if (closedBy) return closedBy;
  return full ? 'full' : null;
}
