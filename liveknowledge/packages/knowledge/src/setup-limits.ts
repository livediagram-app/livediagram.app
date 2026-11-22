// The bounds of Describe to Set Up (docs/specs/030-knowledgebase/describe-to-set-up.md "The model"), and the check
// the room makes before a description reaches the model. The counts themselves live in the room (sql/counters.ts).

export const SETUP_PER_PERSON_PER_HOUR = 5;
export const SETUP_PER_KNOWLEDGEBASE_PER_DAY = 20;
export const SETUP_MIN_DESCRIPTION_CHARS = 20;
export const SETUP_MAX_DESCRIPTION_CHARS = 1000;
/** The most pages one structure holds, and how deep it goes. */
export const SETUP_MAX_PAGES = 30;
export const SETUP_MAX_DEPTH = 3;
export const SETUP_MAX_TITLE_CHARS = 80;
export const SETUP_MAX_SUMMARY_CHARS = 200;
export const SETUP_MAX_HEADINGS = 6;
export const SETUP_MAX_HEADING_CHARS = 80;
/** The most the model may write for one suggestion, its thinking included. */
export const SETUP_MAX_TOKENS = 4000;
/** The most existing page titles sent as context when adding pages: the most pages a knowledgebase holds. */
export const SETUP_MAX_EXISTING_PAGES = 500;

export type SetupRefusal =
  'no-description' | 'description-too-long' | 'person-limit' | 'knowledgebase-limit';

/** Why a description is not sent, or undefined when it may be. `personThisHour` and `knowledgebaseToday` are the
 *  suggestions already counted in the person's hour and the knowledgebase's day. */
export function setupRefusal(
  description: string,
  used: { personThisHour: number; knowledgebaseToday: number },
): SetupRefusal | undefined {
  const described = description.trim();
  if (described.length < SETUP_MIN_DESCRIPTION_CHARS) return 'no-description';
  if (described.length > SETUP_MAX_DESCRIPTION_CHARS) return 'description-too-long';
  if (used.personThisHour >= SETUP_PER_PERSON_PER_HOUR) return 'person-limit';
  if (used.knowledgebaseToday >= SETUP_PER_KNOWLEDGEBASE_PER_DAY) return 'knowledgebase-limit';
  return undefined;
}
