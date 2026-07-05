import { CtaLink } from '@/components/CtaLink';
import type { ReactNode } from 'react';

import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { JsonLd } from '@/components/JsonLd';
import { subpageMetadata } from '@/lib/subpage-metadata';

const FAQ_TITLE = 'FAQ · livediagram';
const FAQ_DESCRIPTION =
  'Common questions about livediagram: accounts, collaboration, self-hosting, and more.';

export const metadata = subpageMetadata({
  title: FAQ_TITLE,
  description: FAQ_DESCRIPTION,
  path: '/faq',
});

// Each entry's `a` is what renders on the page (a ReactNode so we
// can mix prose with anchor links). `aText` is the plain-text form
// the FAQPage JSON-LD emits, since schema.org's Answer.text expects
// a string. Entries whose `a` is already a string can omit
// `aText`; the rest restate the sentence sans markup so the
// structured data stays a faithful image of the visible answer.
const FAQS: { q: string; a: ReactNode; aText?: string }[] = [
  {
    q: 'Do I need an account to use livediagram?',
    a: 'No. Open the editor and start drawing straight away, with no sign-up. An account is optional, and signing in (for free) keeps your diagrams synced across your devices.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. The editor is free to use, with no paid tier and no plan to introduce one. The whole project is open source under the MIT license, so you can also run your own copy at no cost.',
  },
  {
    q: 'What can I make with it?',
    a: 'Flowcharts, mind maps, org charts, retrospectives, kanban boards, roadmaps, story maps, SWOT grids, Business Model Canvases, timelines, Gantt charts, funnels, flywheels, editable tables, pie, bar and line charts, UML class and state diagrams, and UI wireframes for browser, laptop, phone and tablet screens. Forty-three starter templates and twenty-seven themes get you going in seconds.',
  },
  {
    q: 'Can AI help me build or tidy a diagram?',
    a: 'Yes, when it is switched on. Turn on AI assistance in Settings to get an in-editor panel with two modes: Ask, for questions about the diagram in front of you, and Clean, which tidies and tightens the current tab. It is optional and off by default; if you self-host, you supply your own AI provider key.',
  },
  {
    q: 'Can I work on a diagram with my team?',
    a: 'Yes, that is the point. Share a link and your teammates join the same canvas in real time, with live cursors, presence on each tab, comments, and a laser pointer for presenting.',
  },
  {
    q: 'How do share links work?',
    a: 'From a diagram you own, create an editor link (full edit access) or a view-only link (look, do not touch). Anyone with the link can join. You can give a link an expiry when you create it, a week, a month, six months, or never, so it stops working on its own; extend it later if you need longer, or revoke it at any time and it stops working immediately.',
  },
  {
    q: 'Can I set up a team with shared diagrams?',
    a: 'Yes, once you sign in (for free). Create a team from the Explorer, invite people by their email address, and everyone gets a shared folder of diagrams that every member can open and edit. Teams have Admin and Member roles: admins manage who is in the team, everyone else just gets to work. The canvas itself still needs no account; teams simply add a shared home and proper membership on top.',
  },
  {
    q: 'Can I embed a diagram in my docs or wiki?',
    a: 'Yes. Any share link can be embedded as a read-only, live-updating iframe. Copy the embed snippet from the Share dialog and paste it into Notion, Confluence, a wiki, or any page that allows iframes, and it always shows the current state of the diagram.',
  },
  {
    q: 'Can I connect my own AI assistant, like Claude?',
    a: 'Yes. livediagram runs an MCP server at mcp.livediagram.app. Connect a compatible AI tool (such as Claude) and, after a one-time authorization, it can find, read, create, and edit the diagrams in your account on your behalf.',
  },
  {
    q: 'Is there an API?',
    a: 'Yes. Once you sign in, you can create API tokens and call the REST API to read and manage your diagrams programmatically. It is an optional power-user feature; guests and the canvas itself stay completely account-free.',
  },
  {
    q: 'What happens if two people edit the same thing at once?',
    a: 'Every change shows up for everyone live. If two people change the same element at the same moment, the most recent change is the one that sticks.',
  },
  {
    q: 'Is my work saved automatically?',
    a: 'Yes. Every change autosaves on its own, with a status that shows saving, saved, or a problem. Close the tab and reload, and your diagram comes back exactly as you left it.',
  },
  {
    q: 'Can I undo a mistake?',
    a: 'Yes. Undo and redo cover your recent edits. For anything older, each tab keeps an activity log so you can revert a specific change, even after later edits.',
  },
  {
    q: 'Does it work on my phone or tablet?',
    a: 'It runs in any modern browser, with nothing to install. It works well on a laptop, desktop, or tablet; small phone screens are best for viewing rather than heavy editing.',
  },
  {
    q: 'Can I export my diagrams?',
    a: 'Yes. Each tab can be exported as Markdown, PDF, PNG, SVG, or a portable .json file you can import into another diagram. The same Import / Export accordion in the Palette covers both directions.',
  },
  {
    q: 'Where is my data stored, and do you track me?',
    a: (
      <>
        Your diagrams are stored in our database on Cloudflare. There are no tracking pixels, no
        advertising, and no third-party analytics. We do record anonymous, first-party usage (which
        features get used, never your content or name), and show it openly on our{' '}
        <a href="/telemetry">telemetry page</a>. See the{' '}
        <a href="/help/policies/privacy-policy/">privacy policy</a> for the details.
      </>
    ),
    aText:
      'Your diagrams are stored in our database on Cloudflare. There are no tracking pixels, no advertising, and no third-party analytics. We do record anonymous, first-party usage (which features get used, never your content or name), shown openly on our telemetry page. See the privacy policy for the details.',
  },
  {
    q: 'Can I self-host livediagram?',
    a: (
      <>
        Yes. It is MIT-licensed and the source is{' '}
        <a
          href="https://github.com/livediagram-app/monorepo"
          target="_blank"
          rel="noopener noreferrer"
        >
          on GitHub
        </a>
        . Deploy the static frontend plus the Cloudflare Workers backend on your own account and you
        get every feature in the open-source codebase.
      </>
    ),
    aText:
      'Yes. It is MIT-licensed and the source is on GitHub. Deploy the static frontend plus the Cloudflare Workers backend on your own account and you get every feature in the open-source codebase.',
  },
  {
    q: 'How do I delete my data or account?',
    a: 'You can delete any diagram you own at any time, and delete your account and its data yourself from your account settings.',
  },
  {
    q: 'Who makes livediagram?',
    a: (
      <>
        It is built by{' '}
        <a href="https://www.tommcclean.me" target="_blank" rel="noopener noreferrer">
          Tom McClean
        </a>
        . Questions or feedback? Email{' '}
        <a href="mailto:hello@livediagram.app">hello@livediagram.app</a>.
      </>
    ),
    aText: 'It is built by Tom McClean. Questions or feedback? Email hello@livediagram.app.',
  },
];

// FAQPage JSON-LD: unlocks Google's expandable-FAQ rich result
// for this page. Each Question.acceptedAnswer.text falls back to
// the entry's plain-text a-field when aText isn't set (the
// string-typed entries), and uses the parallel aText for entries
// whose `a` carries JSX (so the structured-data text stays
// markup-free). Build-time only, no client JS.
const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.aText ?? (typeof f.a === 'string' ? f.a : ''),
    },
  })),
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={FAQ_JSON_LD} />
      <BreadcrumbJsonLd name="FAQ" path="/faq" />
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Frequently asked questions
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Everything you might want to know before you open the canvas.
        </p>
        <div className="legal-prose mt-10">
          {FAQS.map((f) => (
            <div key={f.q}>
              <h2>{f.q}</h2>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-700">Still have a question?</p>
          <CtaLink href="/new" size="sm" className="mt-3">
            Just start drawing
          </CtaLink>
        </div>
      </main>
      <Footer />
    </>
  );
}
