import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';

const FAQ_TITLE = 'FAQ · livediagram';
const FAQ_DESCRIPTION =
  'Common questions about livediagram: accounts, collaboration, pricing, and more.';

export const metadata: Metadata = {
  title: FAQ_TITLE,
  description: FAQ_DESCRIPTION,
  alternates: { canonical: '/faq' },
  openGraph: {
    type: 'article',
    url: '/faq',
    siteName: 'livediagram',
    title: FAQ_TITLE,
    description: FAQ_DESCRIPTION,
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: FAQ_TITLE,
    description: FAQ_DESCRIPTION,
  },
};

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'Do I need an account to use livediagram?',
    a: 'No. Open the editor and start drawing straight away, with no sign-up. An account is optional, and signing in (for free) keeps your diagrams synced across your devices.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. The editor is free to use today, and the whole project is open source under the MIT license, so you can also run your own copy at no cost.',
  },
  {
    q: 'What can I make with it?',
    a: 'Flowcharts, mind maps, org charts, retrospectives, kanban boards, SWOT grids, timelines, and more. Twelve starter templates and eighteen themes get you going in seconds.',
  },
  {
    q: 'Can I work on a diagram with my team?',
    a: 'Yes, that is the point. Share a link and your teammates join the same canvas in real time, with live cursors, presence on each tab, comments, and a laser pointer for presenting.',
  },
  {
    q: 'How do share links work?',
    a: 'From a diagram you own, create an editor link (full edit access) or a view-only link (look, do not touch). Anyone with the link can join. Revoke a link at any time and it stops working.',
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
    a: 'Not yet. For now your diagrams live in your account and are shared via links. Image and file export is on the roadmap.',
  },
  {
    q: 'Where is my data stored, and do you track me?',
    a: (
      <>
        Your diagrams are stored in our database on Cloudflare. There are no tracking pixels, no
        advertising, and no third-party analytics. See the <a href="/privacy">privacy policy</a> for
        the details.
      </>
    ),
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
  },
];

export default function FaqPage() {
  return (
    <>
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
          <a
            href="/live/new"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            Just start drawing
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
