// What a host hands the Share dialog beyond the item and its links: where its help articles are, how it reports
// to its telemetry, how it says what happened, and, for a guest, the name they share as.

/** The help articles the dialog links to: sharing at large, link lifetimes, and the share password. */
export type ShareHelpArticle = 'sharing' | 'shareLinkExpiry' | 'sharePasswords';
export type ShareHelpHref = (article: ShareHelpArticle) => string | undefined;

/** What the dialog reports, for the host's telemetry (`type` is always a fixed token):
 *  `Copied` ShareLink / EmbedCode / LiveImage, `Removed` ShareLink, `Selected` LiveImageTab,
 *  `Started` ShareTour, `Ended` ShareTourCompleted / ShareTourSkipped, and `Shared` for a link made or changed
 *  (SHARE_TELEMETRY_TYPES: its level, its lifetime, one tab, extended, rescoped, the password set or cleared). */
export type ShareTelemetry = (
  action: 'Copied' | 'Removed' | 'Selected' | 'Started' | 'Ended' | 'Shared',
  type: string,
) => void;

/** `Shared`'s tokens, the names the apps' own Share dialogs always sent: a new link's level, then its lifetime
 *  when it has one and TabScoped when it opens one tab (one event each); Extended, Rescoped, PasswordSet and
 *  PasswordCleared for a change. */
export const SHARE_LEVEL_TELEMETRY = {
  edit: 'Edit',
  participate: 'Participate',
  view: 'View',
} as const;
export const SHARE_EXPIRY_TELEMETRY = {
  week: 'ExpiryWeek',
  month: 'ExpiryMonth',
  sixMonths: 'ExpirySixMonths',
} as const;

/** A note for the person: the host's toast, at its tone. */
export type ShareNotify = (text: string, tone: 'success' | 'info' | 'error') => void;

/** A guest's name, as people in the item see it on cursors and comments ("Sharing as"); omitted for an account,
 *  whose name is the account's. */
export type ShareIdentity = {
  name: string;
  // The avatar's colour, a CSS colour.
  color?: string;
  // Saved when a pass is issued and when the dialog closes, whichever comes first.
  onSave: (name: string) => void | Promise<void>;
  // A fresh random name, for the shuffle; without it there is no shuffle.
  randomName?: () => string;
};
