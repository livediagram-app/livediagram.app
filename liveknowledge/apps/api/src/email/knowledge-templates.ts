// The Knowledgebase Reviews emails (docs/specs/030-knowledgebase/verification.md "Reminders", insights.md "Pages
// that disagree" and "Knowledge Health"): a page's review come due, two pages that disagree, and an Editor's
// reminder to the owners. One switch holds all three (`notifyKnowledgeReviews`), so each carries the settings link
// and the List-Unsubscribe header the other opt-out notices do, and a plain-text alternative.
//
// Everything a person wrote (the knowledgebase's name, a page's title, a conflict's question and passages) is
// escaped for the HTML and flattened to one line for the subject. Each goes only to someone who can open the
// knowledgebase (knowledge/knowledge-emails.ts checks before it builds one).
import { xmlEscape } from '@liveworkspace/icons';
import { mentionQuote, subjectText } from '@liveworkspace/email/layout';
import { DEFAULT_REVIEW_EVERY, type ReviewEvery } from '@liveknowledge/knowledge';
import type { Env } from '../types';
import { manageNotificationsFooter, profilePath, shell } from './brand-layout';
import { kbUrl, link, named, pageUrl, text } from './knowledge-email-parts';
import type { RenderedEmail } from './templates';

/** The pages one email lists; the rest are counted. 100 rows are about 25 KB of HTML: under the 102 KB at which
 *  Gmail clips a message, where 500 rows (a whole knowledgebase due at once) would pass it. */
export const EMAIL_PAGES_LISTED = 100;

/** `knowledgeSettings` is the knowledgebase's own (its Review Period): absent reads as every 90 days. */
export type EmailKnowledgebase = {
  id: string;
  name: string;
  knowledgeSettings?: { reviewEvery: ReviewEvery };
};
export type EmailPage = { tab: string; title: string; state?: 'review-due' | 'never-verified' };
export type EmailConflict = {
  question: string;
  a: { tab: string; title: string; text: string };
  b: { tab: string; title: string; text: string };
};

const pagesWord = (n: number) => `${n.toLocaleString('en')} ${n === 1 ? 'page' : 'pages'}`;
// What the knowledgebase's Review Period is, in a sentence; nothing under Never, where no page comes due.
const PERIOD_WORDS: Record<ReviewEvery, string> = {
  30: 'every 30 days',
  90: 'every 90 days',
  180: 'every 180 days',
  365: 'every year',
  never: '',
};
function reviewPeriodLine(kb: EmailKnowledgebase): string {
  const words = PERIOD_WORDS[kb.knowledgeSettings?.reviewEvery ?? DEFAULT_REVIEW_EVERY];
  return words ? `This knowledgebase reviews pages ${words}.` : '';
}
const STATE_WORDS = { 'review-due': 'Review Due', 'never-verified': 'Never Verified' } as const;

// The pages as list rows and as text lines, the first EMAIL_PAGES_LISTED of them, with what is left counted.
function pageRows(env: Env, kb: EmailKnowledgebase, pages: readonly EmailPage[]) {
  const listed = pages.slice(0, EMAIL_PAGES_LISTED);
  const more = pages.length - listed.length;
  const state = (page: EmailPage) => (page.state ? ` (${STATE_WORDS[page.state]})` : '');
  const points = listed.map(
    (page) =>
      `${link(pageUrl(env, kb, page.tab), named(page.title, 'Untitled Page'))}${state(page)}`,
  );
  const lines = listed.map(
    (page) =>
      `- ${subjectText(named(page.title, 'Untitled Page'))}${state(page)}: ${pageUrl(env, kb, page.tab)}`,
  );
  if (more > 0) {
    points.push(`And ${pagesWord(more)} more.`);
    lines.push(`And ${pagesWord(more)} more.`);
  }
  return { points, lines };
}

/** An owner's pages whose review came due: one email for them all. */
export function reviewDueEmail(
  env: Env,
  kb: EmailKnowledgebase,
  pages: readonly EmailPage[],
): RenderedEmail {
  const name = named(kb.name, 'a knowledgebase');
  const { points, lines } = pageRows(env, kb, pages);
  const count = pagesWord(pages.length);
  const intro = `${count} you own in <strong>${xmlEscape(name)}</strong> ${pages.length === 1 ? 'is' : 'are'} due for review. Read each one, then mark it Still Right or fix it.`;
  const reason = 'You’re receiving this because you own these pages.';
  const period = reviewPeriodLine(kb);
  return {
    kind: 'ReviewDue',
    subject: subjectText(`Pages Due for Review in ${name}`),
    html: shell(env, {
      heading: 'Pages Due for Review',
      preheader: `${count} you own ${pages.length === 1 ? 'is' : 'are'} due for review.`,
      intro,
      points,
      outro:
        `${period} A page stays marked Review Due, for people and for agents, until someone verifies it again.`.trim(),
      ctaText: 'Open the Knowledgebase',
      ctaHref: kbUrl(env, kb),
      footer: manageNotificationsFooter(env, reason),
    }),
    text: text(
      env,
      [
        `Pages Due for Review in ${subjectText(name)}`,
        '',
        `${count} you own ${pages.length === 1 ? 'is' : 'are'} due for review. Read each one, then mark it Still Right or fix it.`,
        '',
        ...lines,
        ...(period ? ['', period] : []),
        '',
        `Open the knowledgebase: ${kbUrl(env, kb)}`,
      ],
      reason,
    ),
    unsubscribeUrl: profilePath(env),
  };
}

/** An Editor's reminder (Knowledge Health): an owner's pages that are due and those never verified. */
export function remindOwnersEmail(
  env: Env,
  kb: EmailKnowledgebase,
  pages: readonly EmailPage[],
): RenderedEmail {
  const name = named(kb.name, 'a knowledgebase');
  const { points, lines } = pageRows(env, kb, pages);
  const count = pagesWord(pages.length);
  const lead = (kb: string) => `An Editor of ${kb} asked its page owners to look at their pages.`;
  const says = `${count} you own ${pages.length === 1 ? 'is' : 'are'} due for review or ${pages.length === 1 ? 'was' : 'were'} never verified.`;
  const reason =
    'You’re receiving this because you own these pages and an Editor reminded the owners.';
  const period = reviewPeriodLine(kb);
  return {
    kind: 'OwnersReminded',
    subject: subjectText(`Pages to Review in ${name}`),
    html: shell(env, {
      heading: 'Pages to Review',
      preheader: says,
      intro: `${lead(`<strong>${xmlEscape(name)}</strong>`)} ${says}`,
      points,
      outro: `${period} Verify a page that is right, and fix one that is not.`.trim(),
      ctaText: 'Open the Knowledgebase',
      ctaHref: kbUrl(env, kb),
      footer: manageNotificationsFooter(env, reason),
    }),
    text: text(
      env,
      [
        `Pages to Review in ${subjectText(name)}`,
        '',
        `${lead(subjectText(name))} ${says}`,
        '',
        ...lines,
        ...(period ? ['', period] : []),
        '',
        `Open the knowledgebase: ${kbUrl(env, kb)}`,
      ],
      reason,
    ),
    unsubscribeUrl: profilePath(env),
  };
}

/** Two pages state opposite facts and an Editor asked both owners (a conflict's Ask Both Owners). The passages are
 *  quoted as plain text, each cut at a word (`mentionQuote`, 280 characters). */
export function pagesDisagreeEmail(
  env: Env,
  kb: EmailKnowledgebase,
  conflict: EmailConflict,
): RenderedEmail {
  const name = named(kb.name, 'a knowledgebase');
  const insightsUrl = `${kbUrl(env, kb)}?view=insights`;
  const sides = [conflict.a, conflict.b].map((side) => ({
    title: named(side.title, 'Untitled Page'),
    href: pageUrl(env, kb, side.tab),
    quote: mentionQuote(side.text),
  }));
  const question = mentionQuote(conflict.question);
  const reason =
    'You’re receiving this because you own one of these pages and an Editor asked both owners.';
  return {
    kind: 'PagesDisagree',
    subject: subjectText(`Two Pages Disagree in ${name}`),
    html: shell(env, {
      heading: 'Two Pages Disagree',
      preheader: `Two pages in ${xmlEscape(name)} answer the same question differently.`,
      intro: `Two pages in <strong>${xmlEscape(name)}</strong> answer the same question differently, and an Editor asked their owners to settle which is right: <strong>${xmlEscape(question)}</strong>`,
      points: sides.map(
        (side) => `${link(side.href, side.title)} says: “${xmlEscape(side.quote)}”`,
      ),
      outro:
        'Fix the page that is wrong. The disagreement closes by itself when either passage changes.',
      ctaText: 'See Both Passages',
      ctaHref: insightsUrl,
      footer: manageNotificationsFooter(env, reason),
    }),
    text: text(
      env,
      [
        `Two Pages Disagree in ${subjectText(name)}`,
        '',
        `Two pages answer the same question differently, and an Editor asked their owners to settle which is right: ${question}`,
        '',
        ...sides.flatMap((side) => [
          `- ${subjectText(side.title)}: ${side.href}`,
          `  "${side.quote}"`,
        ]),
        '',
        `See both passages: ${insightsUrl}`,
      ],
      reason,
    ),
    unsubscribeUrl: profilePath(env),
  };
}

/** A page its owner answers for was rejected (docs/specs/030-knowledgebase/approval.md "Email"): who rejected it,
 *  and their note quoted as plain text, cut at a word (`mentionQuote`). */
export function pageRejectedEmail(
  env: Env,
  kb: EmailKnowledgebase,
  page: { tab: string; title: string },
  rejectedBy: string,
  note: string | undefined,
): RenderedEmail {
  const name = named(kb.name, 'a knowledgebase');
  const title = named(page.title, 'Untitled Page');
  const who = named(rejectedBy, 'Someone');
  const href = pageUrl(env, kb, page.tab);
  const quote = note ? mentionQuote(note) : '';
  const reason = 'You’re receiving this because you own this page.';
  return {
    kind: 'PageRejected',
    subject: subjectText(`${title} Was Rejected in ${name}`),
    html: shell(env, {
      heading: 'A Page Was Rejected',
      preheader: `${xmlEscape(who)} rejected ${xmlEscape(title)}.`,
      intro: `${xmlEscape(who)} rejected ${link(href, title)} in <strong>${xmlEscape(name)}</strong>.`,
      points: quote ? [`“${xmlEscape(quote)}”`] : [],
      outro: 'Change what needs changing, then ask for approval again.',
      ctaText: 'Open the Page',
      ctaHref: href,
      footer: manageNotificationsFooter(env, reason),
    }),
    text: text(
      env,
      [
        `${subjectText(title)} Was Rejected in ${subjectText(name)}`,
        '',
        `${subjectText(who)} rejected ${subjectText(title)}.`,
        ...(quote ? ['', `"${quote}"`] : []),
        '',
        `Open the page: ${href}`,
      ],
      reason,
    ),
    unsubscribeUrl: profilePath(env),
  };
}
