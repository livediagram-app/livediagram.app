import type { ReactNode } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';

// The chrome every top-level browse page in the help centre wears: a
// breadcrumb, a title, a lede, and a responsive grid of cards. Eleven pages
// (Getting Started, Features, Troubleshooting, About, Policies, ...) rendered
// this same tree inline, differing only in the three things that are props
// here. Changing the header design meant editing eleven files, and the class
// strings had to be retyped correctly each time a category was added.
//
// The breadcrumb label and the heading are ONE prop because on every one of
// those pages they were the same string. If a page ever needs them to differ
// it should say so explicitly rather than have every caller pass the value
// twice today.
//
// `/help/contact/` deliberately does NOT use this: it is a narrower column
// (max-w-3xl) with prose-weight body text and a stack of link cards rather
// than a grid, so it shares the look of the header but not the layout.
export function BrowsePage({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Breadcrumb items={[{ label: title }]} />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl">{title}</h1>
        <p className="mb-8 text-base leading-relaxed text-slate-500 md:text-lg">{lede}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
      </div>
    </div>
  );
}
