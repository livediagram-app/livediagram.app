// The Daily Digest of Watched Pages (docs/specs/030-knowledgebase/watching.md "The daily digest email"): one email a
// day a knowledgebase, listing each page with an update for the watcher since their last digest, what happened and
// who. Off until the watcher turns `notifyWatchDigest` on, so it carries the settings link and the List-Unsubscribe
// header every opt-out notice does, and a plain-text alternative. Page titles and people's names are escaped for the
// HTML and flattened to one line for the text.
import { xmlEscape } from '@liveworkspace/icons';
import { subjectText } from '@liveworkspace/email/layout';
import type { UpdateActor, UpdateKind } from '@liveworkspace/index-client';
import type { Env } from '../types';
import { manageNotificationsFooter, profilePath, shell } from './brand-layout';
import { kbUrl, link, named, pageUrl, text } from './knowledge-email-parts';
import { EMAIL_PAGES_LISTED, type EmailKnowledgebase } from './knowledge-templates';
import type { RenderedEmail } from './templates';

/** One page's line: what happened to it and who did it, newest first. */
export type DigestPage = {
  tab: string;
  title: string;
  kinds: readonly UpdateKind[];
  actors: readonly UpdateActor[];
  actorCount: number;
};

const KIND_WORDS: Record<UpdateKind, string> = {
  saved: 'Edited',
  review_due: 'Verification lapsed',
  approved: 'Approved',
  rejected: 'Rejected',
  moved: 'Moved',
  deleted: 'Deleted',
};

/** "Priya Shah", "Priya Shah and Sam Lee", "Priya Shah and 3 others". */
export function actorsLine(actors: readonly UpdateActor[], count: number): string {
  const names = actors.map((a) => named(a.name, 'Someone'));
  const total = Math.max(count, names.length);
  if (names.length === 0) return '';
  if (total === 1) return names[0]!;
  if (total === 2 && names.length >= 2) return `${names[0]} and ${names[1]}`;
  const rest = total - 1;
  return `${names[0]} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}

/** "Edited and moved by Priya Shah", "Verification lapsed". */
export function digestLine(page: DigestPage): string {
  const words = page.kinds.map((kind, i) =>
    i === 0 ? KIND_WORDS[kind] : KIND_WORDS[kind].toLowerCase(),
  );
  const what =
    words.length <= 1
      ? (words[0] ?? 'Changed')
      : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  const by = actorsLine(page.actors, page.actorCount);
  return by ? `${what} by ${by}` : what;
}

export function watchDigestEmail(
  env: Env,
  kb: EmailKnowledgebase,
  pages: readonly DigestPage[],
): RenderedEmail {
  const name = named(kb.name, 'a knowledgebase');
  const listed = pages.slice(0, EMAIL_PAGES_LISTED);
  const more = pages.length - listed.length;
  const count = `${pages.length.toLocaleString('en')} ${pages.length === 1 ? 'page' : 'pages'}`;
  const moreLine = more > 0 ? `And ${more.toLocaleString('en')} more.` : null;
  const points = listed.map(
    (page) =>
      `${link(pageUrl(env, kb, page.tab), named(page.title, 'Untitled Page'))}: ${xmlEscape(digestLine(page))}`,
  );
  const lines = listed.map(
    (page) =>
      `- ${subjectText(named(page.title, 'Untitled Page'))}: ${digestLine(page)}. ${pageUrl(env, kb, page.tab)}`,
  );
  const reason =
    'You’re receiving this because you watch these pages and turned on the Daily Digest of Watched Pages.';
  return {
    kind: 'WatchDigest',
    subject: subjectText(`Changes to Pages You Watch in ${name}`),
    html: shell(env, {
      heading: 'Changes to Pages You Watch',
      preheader: `${count} you watch changed in ${xmlEscape(name)}.`,
      intro: `${count} you watch in <strong>${xmlEscape(name)}</strong> changed since your last digest.`,
      points: moreLine ? [...points, moreLine] : points,
      outro: 'Unwatch a page from its menu, or from Watch in its Page Info.',
      ctaText: 'Open the Knowledgebase',
      ctaHref: kbUrl(env, kb),
      footer: manageNotificationsFooter(env, reason),
    }),
    text: text(
      env,
      [
        `Changes to Pages You Watch in ${subjectText(name)}`,
        '',
        `${count} you watch changed since your last digest.`,
        '',
        ...lines,
        ...(moreLine ? [moreLine] : []),
        '',
        `Open the knowledgebase: ${kbUrl(env, kb)}`,
      ],
      reason,
    ),
    unsubscribeUrl: profilePath(env),
  };
}
