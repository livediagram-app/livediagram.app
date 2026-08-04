import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { helpMetadata } from '@/lib/seo';

export const metadata: Metadata = helpMetadata({
  title: 'Contact',
  description: 'Get in touch with the livediagram team, report a bug, or request a feature.',
  path: '/help/contact/',
});

const ExternalIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
);

export default function ContactPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Contact' }]} />
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl">Contact</h1>
        <p className="mb-8 text-base leading-relaxed text-slate-600 md:text-lg">
          We are happy to help. Pick whichever route fits.
        </p>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:border-slate-300 sm:p-6">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Email Us</h2>
            <p className="mb-4 leading-relaxed text-slate-600">
              Questions, feedback, or trouble with a feature? Email the team and we will get back to
              you.
            </p>
            <a
              href="mailto:hello@livediagram.app"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-600"
            >
              hello@livediagram.app
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:border-slate-300 sm:p-6">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              Report a Bug or Request a Feature
            </h2>
            <p className="mb-4 leading-relaxed text-slate-600">
              livediagram is open source. Open an issue on GitHub to report a bug, suggest an idea,
              or follow along with development.
            </p>
            <a
              href="https://github.com/livediagram-app/livediagram.app/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-400 hover:bg-slate-50"
            >
              Open an issue on GitHub
              {ExternalIcon}
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Browse the Guides</h2>
            <p className="leading-relaxed text-slate-600">
              Many questions are already answered here. Try the search on the{' '}
              <a
                href="/help/"
                className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
              >
                help home
              </a>
              , or browse the{' '}
              <a
                href="/help/features/"
                className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
              >
                feature guides
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
