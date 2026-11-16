// Email to Board on the wire (docs/specs/026-plan/email-to-board.md "Managing an address"; blueprint
// email-to-board.md "Interfaces and contracts"): the routes an Editor of the whole plan manages a board's address with.

/** Who Can Send: the plan's members only, or anyone with the address. */
export const EMAIL_INTAKE_SENDERS = ['members', 'anyone'] as const;
export type EmailIntakeSenders = (typeof EMAIL_INTAKE_SENDERS)[number];

export const isEmailIntakeSenders = (v: unknown): v is EmailIntakeSenders =>
  typeof v === 'string' && (EMAIL_INTAKE_SENDERS as readonly string[]).includes(v);

/** A board's address as an Editor sees it: the address, Who Can Send, when it was made and what it has done. */
export type EmailIntake = {
  boardId: string;
  address: string;
  senders: EmailIntakeSenders;
  createdAt: number;
  made: number;
  refused: number;
  dropped: number;
  // When it last made a card (epoch ms), or null for none yet.
  lastAt: number | null;
};

/** A board that may have an address: its element id, title and tab, and its first column's name (null: it has no
 *  column for new cards, an All Cards or archive board). */
export type EmailIntakeBoard = {
  id: string;
  title: string;
  tabId: string;
  tabName: string;
  column: string | null;
};

/** GET /api/projects/:id/email-intake. `available` false (and `domain` null) on a server that takes no mail. */
export type EmailIntakesResponse = {
  available: boolean;
  domain: string | null;
  intakes: EmailIntake[];
  boards: EmailIntakeBoard[];
};

/** PUT /api/projects/:id/email-intake/:boardId and POST …/new-address. */
export type EmailIntakeResponse = { intake: EmailIntake };

/** The refusals the routes name. */
export const EMAIL_INTAKE_ERRORS = [
  'email_intake_needs_editor',
  'email_intake_invalid',
  'email_intake_not_found',
  'email_intake_unavailable',
] as const;
export type EmailIntakeError = (typeof EMAIL_INTAKE_ERRORS)[number];

/** The local part every board address starts with. */
export const EMAIL_INTAKE_PREFIX = 'board+';

/** A board's address for its code on the intake domain. */
export const emailIntakeAddress = (code: string, domain: string): string =>
  `${EMAIL_INTAKE_PREFIX}${code}@${domain}`;
