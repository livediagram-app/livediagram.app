import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ALTERNATIVES } from '@/lib/alternatives';
import { subpageMetadata } from '@/lib/subpage-metadata';

// Hub page for the comparison set (see specs/21-comparison-pages.md): a
// crawlable parent that links to every /alternatives/<slug> page.
export const metadata = subpageMetadata({
  title: 'How livediagram compares · alternatives',
  description:
    'How livediagram stacks up against Miro, XMind, Excalidraw, draw.io, and Google Slides for diagrams. Honest, side-by-side comparisons.',
  path: '/alternatives',
});

export default function AlternativesIndexPage() {
  return (
    <>
      <BreadcrumbJsonLd name="Alternatives" path="/alternatives" />
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          How livediagram compares
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          Thinking about another tool? Here&rsquo;s an honest, side-by-side look at how livediagram
          compares, including where each one is the better pick.
        </p>
        <ul className="mt-10 space-y-3">
          {ALTERNATIVES.map((alt) => (
            <li key={alt.slug}>
              <a
                href={`/alternatives/${alt.slug}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
              >
                <span>
                  <span className="block font-semibold text-slate-900">{alt.h1}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    livediagram vs {alt.name}
                  </span>
                </span>
                <span aria-hidden className="text-brand-500">
                  →
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-700">Or just try it, no sign-up required.</p>
          <a
            href="/live/new"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Start drawing
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
