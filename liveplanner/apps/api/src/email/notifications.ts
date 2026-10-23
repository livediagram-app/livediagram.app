// docs/specs/014-identity/profile-and-email-notifications.md: the opt-out transactional notifications layered on top
// of the docs/specs/014-identity/transactional-email.md email feature (a new comment, a form response, a suspended
// form). Each is best-effort, fired from `ctx.waitUntil` on a request made by SOMEONE OTHER than the recipient, so
// the recipient's address comes from trusted server state (email_lifecycle), never the caller's headers, and their
// opt-out is read from user_preferences (docs/specs/007-editor/user-preferences.md).
//
// Like every docs/specs/014-identity/transactional-email.md send these never throw — sendEmail swallows failures — so
// a notification problem can't break the request that triggered it.

import { claimFormEmail, getNotificationPrefs, getOwnerEmail } from '../db';
import { claimCommentNotify } from '../plan-room/plan-content';
import type { Env, PlanEnv } from '../types';
import { emailEnabled, sendEmail } from './client';

// At most one "new comment" email per project per this window (docs/specs/014-identity/transactional-email.md #1), so a
// burst of comments doesn't spam the owner.
const COMMENT_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;
// At most one "new response" email per form per this window (docs/specs/030-forms/forms.md "Hearing about
// responses"); the next one says how many came while it was held. Safe range 5..60 minutes.
const FORM_EMAIL_THROTTLE_MS = 15 * 60 * 1000;
import { commentNotificationEmail, formResponseEmail, formSuspendedEmail } from './templates';

// Someone OTHER than the owner left a comment on a project the owner owns
// (docs/specs/014-identity/transactional-email.md #1). Immediate, opt-out (notifyComments). Best-effort; never blocks
// the comment write. The comment text is deliberately NOT included.
export async function notifyNewComment(
  env: PlanEnv,
  liveDoc: { id: string; ownerId: string; name: string },
  commenterName: string | null,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await getOwnerEmail(env, liveDoc.ownerId);
  if (!to) return;
  const prefs = await getNotificationPrefs(env, liveDoc.ownerId);
  if (!prefs.notifyComments) return;
  // Throttle so a burst of comments is one email, not one per comment.
  const now = Date.now();
  if (!(await claimCommentNotify(env, liveDoc.id, now, now - COMMENT_NOTIFY_THROTTLE_MS))) return;
  await sendEmail(env, {
    to,
    ...commentNotificationEmail(env, liveDoc.name, liveDoc.id, commenterName),
  });
}

// A respondent filled in a form on a project the owner owns (docs/specs/030-forms/forms.md "Hearing about
// responses"). Opt-out (notifyFormResponses), throttled per form; never blocks the response.
export async function notifyFormResponse(
  env: Env,
  liveDoc: { id: string; ownerId: string; name: string },
  form: { code: string; heading: string },
  cardTitle: string,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await getOwnerEmail(env, liveDoc.ownerId);
  if (!to) return;
  const prefs = await getNotificationPrefs(env, liveDoc.ownerId);
  if (!prefs.notifyFormResponses) return;
  const claim = await claimFormEmail(env, form.code, Date.now(), FORM_EMAIL_THROTTLE_MS);
  if (!claim.send) {
    console.info('[forms] form.email.held', { projectId: liveDoc.id });
    return;
  }
  await sendEmail(env, {
    to,
    ...formResponseEmail(
      env,
      { heading: form.heading, projectId: liveDoc.id, projectName: liveDoc.name },
      cardTitle,
      claim.heldBefore,
    ),
  });
  console.info('[forms] form.email.sent', { projectId: liveDoc.id });
}

// A form link suspended after reports (docs/specs/030-forms/forms.md "Report This Form"): always sent, where email is
// configured and the owner has an address.
export async function notifyFormSuspended(
  env: Env,
  liveDoc: { id: string; ownerId: string; name: string },
  heading: string,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await getOwnerEmail(env, liveDoc.ownerId);
  if (!to) return;
  await sendEmail(env, {
    to,
    ...formSuspendedEmail(env, { heading, projectId: liveDoc.id, projectName: liveDoc.name }),
  });
}
