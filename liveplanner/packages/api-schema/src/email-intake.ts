// Email to Board on the wire (docs/specs/026-plan/email-to-board.md "Managing an address"; blueprint
// email-to-board.md "Interfaces and contracts"): the routes an Editor of the whole plan manages a board's address with.

/** Who Can Send: the plan's members only, or anyone with the address. */
export const EMAIL_INTAKE_SENDERS = ['members', 'anyone'] as const;
export type EmailIntakeSenders = (typeof EMAIL_INTAKE_SENDERS)[number];

export const isEmailIntakeSenders = (v: unknown): v is EmailIntakeSenders =>
  typeof v === 'string' && (EMAIL_INTAKE_SENDERS as readonly string[]).includes(v);

/** What an address makes of each message (docs/specs/026-plan/email-to-board.md "What a message makes"): a card of a
 *  type in a column, by name, and the boards that show such a card. */
export type EmailIntakeTarget = {
  typeId: string;
  status: string;
  cardType: string;
  column: string;
  // The Board tabs whose boards show the card, in tab order.
  showsOn: string[];
};

/** A board's address as an Editor sees it: the address, Who Can Send, when it was made and what it has done. */
export type EmailIntake = {
  boardId: string;
  address: string;
  // What its mail becomes; null while no board shows such a card (its type or column gone), when mail is refused.
  target: EmailIntakeTarget | null;
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
  // What an address turned on here makes unless told otherwise: the board's first card type in its first column.
  target: EmailIntakeTarget | null;
};

/** A card type an address may make, with the columns its cards can be seen in across the plan's boards. */
export type EmailIntakeType = {
  id: string;
  label: string;
  columns: { status: string; name: string }[];
};

/** GET /api/projects/:id/email-intake. `available` false (and `domain` null) on a server that takes no mail. */
export type EmailIntakesResponse = {
  available: boolean;
  domain: string | null;
  intakes: EmailIntake[];
  boards: EmailIntakeBoard[];
  // The card types some board shows, each with its columns: what an address's Card Type and Column offer.
  types: EmailIntakeType[];
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
