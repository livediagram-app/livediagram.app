// The Knowledgebase Reviews emails' times (docs/specs/030-knowledgebase/verification.md "Reminders"), apart from
// the senders so the room reads a number without their imports.
const DAY_MS = 86_400_000;
/** An owner is sent one Review Due email in this long, a knowledgebase. */
export const REVIEW_EMAIL_GAP_MS = DAY_MS;
/** The owners are reminded once in this long, a knowledgebase. */
export const REMIND_OWNERS_GAP_MS = 7 * DAY_MS;
/** How long after a page's verification, or the knowledgebase's Review Period, changes the review check runs: a
 *  burst is one check. */
export const REVIEW_CHECK_DELAY_MS = 60_000;
