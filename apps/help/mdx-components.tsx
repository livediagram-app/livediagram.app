import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { articles, categories, articleHref, categoryHref } from '@/lib/articles';
import {
  FEATURE_FALLBACK_HEX,
  FEATURE_TILE_CLASS,
  featureColour,
  featureTileStyle,
} from '@/lib/featureColours';
import { featureIcon } from '@/lib/featureIcons';
import { Figure } from './components/Figure';
import { NoteIcon, TipIcon } from '@/lib/chrome-icons';

/** Numbered step indicator for walkthroughs. Shows section.step numbering
 *  via CSS counters (see globals.css). */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="step-item mb-6 flex gap-4">
      <div
        className="step-number flex h-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 px-2.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
        data-n={n}
      />
      <div className="flex-1 pt-0.5">{children}</div>
    </div>
  );
}

/** Tip callout box (brand-toned). */
function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/15">
      <TipIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-500 dark:text-brand-300" />
      <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 [&>p]:mb-0">
        {children}
      </div>
    </div>
  );
}

/** Warning / important callout box (amber). */
function Note({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/50 dark:bg-amber-500/10">
      <NoteIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
      <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 [&>p]:mb-0">
        {children}
      </div>
    </div>
  );
}

/** Feature card with icon, linking to the feature's help page. Pass the
 *  feature `slug` (e.g. "canvas"); the icon + colour come from the shared
 *  feature maps. */
function Feature({ slug, title, children }: { slug?: string; title: string; children: ReactNode }) {
  // Resolve the slug to a real page: an article landing first, then a feature
  // category index, otherwise render a non-linking card (so a slug with no
  // destination never becomes a dead link). `Link` prepends the /help basePath,
  // so these hrefs omit it.
  const article = slug ? articles.find((a) => a.slug === slug) : undefined;
  // Resolved through the shared helpers so an MDX tile matches the card the
  // same feature gets on its category index. Both fall back to the feature's
  // top-level category, which is why the registered article is looked up first:
  // without its categorySlug there is nothing to fall back TO, and a landing
  // with no bespoke glyph rendered a hue-less card with no icon tile at all.
  const colour = slug ? featureColour(slug, article?.categorySlug) : FEATURE_FALLBACK_HEX;
  const icon = slug ? featureIcon(slug, article?.categorySlug) : null;
  const href = article
    ? articleHref(article)
    : slug && categories.some((c) => c.slug === slug)
      ? categoryHref(slug)
      : undefined;

  const card = (
    <div
      className={`h-full rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${
        href
          ? 'transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
          : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${FEATURE_TILE_CLASS}`}
            style={featureTileStyle(colour)}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <div className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 [&>p]:mb-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {card}
      </Link>
    );
  }
  return card;
}

/** Grid of feature cards. */
function FeatureGrid({ children }: { children: ReactNode }) {
  return <div className="my-5 grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}

export { Step, Tip, Note, Feature, FeatureGrid, Figure };

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mb-4 mt-8 text-3xl font-bold text-slate-900 md:text-4xl dark:text-slate-100">
        {children}
      </h1>
    ),
    h2: ({ children }) => {
      const text = typeof children === 'string' ? children : String(children ?? '');
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return (
        <h2
          id={id}
          className="mb-4 mt-10 flex items-center gap-3 text-xl font-bold text-slate-900 md:text-2xl dark:text-slate-100"
        >
          <span className="section-number flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" />
          {children}
        </h2>
      );
    },
    h3: ({ children }) => (
      <h3 className="mb-2 mt-6 text-lg font-semibold text-slate-800 dark:text-slate-100">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="mb-4 text-[15px] leading-[1.8] text-slate-600 dark:text-slate-300">
        {children}
      </p>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-brand-600 underline underline-offset-2 transition-colors hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="mb-5 ml-1 space-y-2.5 text-slate-600 dark:text-slate-300 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[10px] [&>li]:before:h-2 [&>li]:before:w-2 [&>li]:before:rounded-full [&>li]:before:bg-brand-400 [&>li]:before:content-['']">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="counter-reset-[step] mb-5 ml-1 list-none space-y-2.5 text-slate-600 dark:text-slate-300 [&>li]:relative [&>li]:pl-8 [&>li]:counter-increment-[step] [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-0 [&>li]:before:flex [&>li]:before:h-5 [&>li]:before:w-5 [&>li]:before:items-center [&>li]:before:justify-center [&>li]:before:rounded-full [&>li]:before:bg-brand-100 [&>li]:before:text-xs [&>li]:before:font-bold [&>li]:before:text-brand-700 [&>li]:before:content-[counter(step)] dark:[&>li]:before:bg-brand-500/20 dark:[&>li]:before:text-brand-300">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
    code: ({ children }) => (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-brand-700 dark:bg-slate-800 dark:text-brand-300">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="mb-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
        {children}
      </pre>
    ),
    // Tables had no overrides at all, so a markdown table rendered as
    // unpadded browser default: columns touching, no rules, a key and its
    // description reading as one run-on line. The shortcut references are
    // mostly tables, which is where it hurt.
    table: ({ children }) => (
      <div className="mb-5 overflow-x-auto">
        <table className="w-full border-collapse text-left text-[15px]">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-slate-100 px-3 py-2 align-top leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
        {children}
      </td>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-5 rounded-r-lg border-l-4 border-brand-500 bg-slate-50 py-3 pl-4 pr-4 italic text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        {children}
      </blockquote>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
    ),
    hr: () => (
      <hr className="my-8 h-px border-0 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
    ),
    Step,
    Tip,
    Note,
    Feature,
    FeatureGrid,
    Figure,
    ...components,
  };
}
