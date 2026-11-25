import type { ComponentType } from 'react';

// What it can do (docs/specs/019-marketing/build-with-ai.md "The page" 5, in each product): the MCP's tools in plain
// words, one card each. The cards are the product's (each maps to a shipped tool); the grid is this one, the same on
// every Build with AI page.

export type AiCapability = {
  icon: ComponentType<{ 'aria-hidden'?: boolean }>;
  title: string;
  body: string;
};

/** `columns` on wide screens: three, or four for a product with eight cards. */
export function AiCapabilityGrid({
  items,
  columns = 3,
}: {
  items: readonly AiCapability[];
  columns?: 3 | 4;
}) {
  return (
    <ul
      className={`grid gap-4 sm:grid-cols-2 ${columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
    >
      {items.map(({ icon: Icon, title, body }) => (
        <li
          key={title}
          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <Icon aria-hidden />
          </span>
          <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {body}
          </p>
        </li>
      ))}
    </ul>
  );
}
