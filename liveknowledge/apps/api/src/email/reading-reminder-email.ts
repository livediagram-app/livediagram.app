// Remind on a Required Reading page (docs/specs/030-knowledgebase/required-reading.md "Remind"): one email each person
// asked who has not confirmed, naming who asked and the page as a link. Under the Knowledgebase Reviews switch, so it
// carries the settings link and the List-Unsubscribe header the other opt-out notices do, and a plain-text
// alternative. The page's title, the knowledgebase's name and the sender's name are escaped for the HTML and
// flattened to one line for the subject.
import { xmlEscape } from '@liveworkspace/icons';
import { subjectText } from '@liveworkspace/email/layout';
import type { Env } from '../types';
import { manageNotificationsFooter, profilePath, shell } from './brand-layout';
import { kbUrl, link, named, pageUrl, text } from './knowledge-email-parts';
import type { EmailKnowledgebase } from './knowledge-templates';
import type { RenderedEmail } from './templates';

export function readingReminderEmail(
  env: Env,
  kb: EmailKnowledgebase,
  page: { tab: string; title: string },
  from: string,
): RenderedEmail {
  const name = named(kb.name, 'a knowledgebase');
  const title = named(page.title, 'Untitled Page');
  const who = named(from, 'An Editor');
  const href = pageUrl(env, kb, page.tab);
  const says = `${who} asked you to read ${title} in ${name}, and to confirm once you have.`;
  const reason =
    'You’re receiving this because this page is Required Reading for you and you have not confirmed it yet.';
  return {
    kind: 'ReadingReminder',
    subject: subjectText(`Please Read ${title}`),
    html: shell(env, {
      heading: `Please Read ${xmlEscape(title)}`,
      preheader: xmlEscape(says),
      intro: `<strong>${xmlEscape(who)}</strong> asked you to read ${link(href, title)} in <strong>${xmlEscape(name)}</strong>.`,
      outro: 'Open the page, read it through, then press I’ve Read This at its top.',
      ctaText: 'Read the Page',
      ctaHref: href,
      footer: manageNotificationsFooter(env, reason),
    }),
    text: text(
      env,
      [
        `Please Read ${subjectText(title)}`,
        '',
        says.split(/[\r\n]+/).join(' '),
        '',
        `Read the page: ${href}`,
        `Open the knowledgebase: ${kbUrl(env, kb)}`,
      ],
      reason,
    ),
    unsubscribeUrl: profilePath(env),
  };
}
