// What an app hands the builders (liveworkspace/docs/specs/023-chat-apps/chat-apps.md "The builders"): an answer
// with its citation numbers, its sources and their trust, what it did not cover and what answered; and a link's
// preview. Plain data in the app's own words: the builders add only the chat's markup.

export type ChatPlatform = 'slack' | 'teams';

/** How far a source can be trusted, as the app's page shows it. `off`: no trust is drawn (a Review Period of
 *  Never). */
export type ChatTrust =
  | { state: 'verified'; verifiedAt: number; verifiedBy?: string }
  | { state: 'due'; verifiedAt?: number }
  | { state: 'never' }
  | { state: 'off' };

export type ChatSource = {
  number: number;
  title: string;
  /** A link on the app's own origin. */
  url: string;
  trust: ChatTrust;
  health?: { score: number; label: string };
};

export type ChatAnswerPart = { kind: 'text'; text: string } | { kind: 'cite'; number: number };

export type ChatAnswer = {
  question: string;
  /** The answer as text and citation numbers; a number with no source stays the text it was. */
  parts: ChatAnswerPart[];
  sources: ChatSource[];
  /** "Answered from 3 verified pages", or null. */
  trustLine: string | null;
  /** Each part the pages did not cover. */
  gaps: string[];
  /** The line under the gaps (they went to the app's list of unanswered questions), or null. */
  gapsNote: string | null;
  /** The line at the foot: the item's name and which AI answered. */
  footer: string;
  open: { label: string; url: string };
  /** Slack: a Share in Channel button's value (the kept answer's id), or null for none. */
  share: { label: string; value: string } | null;
  /** Slack: the line heading an answer shared in a channel ("Shared by <@U123>"), already in Slack's markup. */
  sharedBy?: string | null;
};

export type ChatPreview = {
  title: string;
  /** A link on the app's own origin. */
  url: string;
  excerpt: string;
  /** The owner's name, or null. */
  owner: string | null;
  trust: ChatTrust;
  /** The line at the foot: the app's and the item's names. */
  footer: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "21 Nov", in UTC: the same words whatever the server's locale. */
export function dayMonth(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** A source's trust in words, as the page's badges say it; empty for `off`. */
export function trustWords(trust: ChatTrust): string {
  switch (trust.state) {
    case 'verified':
      return `Verified ${dayMonth(trust.verifiedAt)}${trust.verifiedBy ? ` by ${trust.verifiedBy}` : ''}`;
    case 'due':
      return trust.verifiedAt === undefined
        ? 'Review Due'
        : `Review Due, last verified ${dayMonth(trust.verifiedAt)}`;
    case 'never':
      return 'Never Verified';
    default:
      return '';
  }
}

/** A source's trust and health on one line: "Verified 21 Nov by Roger Blake · Health 82, Good". */
export function sourceLine(source: Pick<ChatSource, 'trust' | 'health'>): string {
  const health = source.health ? `Health ${source.health.score}, ${source.health.label}` : '';
  return [trustWords(source.trust), health].filter(Boolean).join(' · ');
}
