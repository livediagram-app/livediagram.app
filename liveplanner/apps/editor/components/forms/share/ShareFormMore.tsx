'use client';

// Share Form's More Ways to Share (docs/specs/030-forms/forms.md "Publishing and the form link"): a disclosure, closed
// by default, under a live link. Its panels (QR Code, Embed, Pre-filled Link) load the first time it opens and stay
// mounted after, so closing and reopening keeps the picks.
import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { PublicForm } from '@liveplanner/forms';
import { AccordionSection } from '@liveworkspace/workbench/components/primitives/AccordionSection';

const ShareWays = dynamic(() => import('./ShareWays').then((m) => m.ShareWays), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Loading"
      className="h-40 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
    />
  ),
});

export function ShareFormMore({ url, form }: { url: string; form: PublicForm }) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200 px-3 dark:border-slate-700">
      <AccordionSection
        title="More Ways to Share"
        open={open}
        onToggle={() => {
          setOpen((o) => !o);
          setOpened(true);
        }}
        headerClassName="flex w-full cursor-pointer items-center justify-between py-2.5 text-left"
        titleClassName="text-[14px] font-medium text-slate-800 dark:text-slate-100"
        trailing={
          open ? null : (
            <span className="text-[12px] text-slate-500 max-sm:hidden dark:text-slate-400">
              QR Code, Embed, Pre-filled Link
            </span>
          )
        }
        bodyClassName="flex flex-col gap-3 pb-3 pt-1"
      >
        {opened ? <ShareWays url={url} form={form} /> : null}
      </AccordionSection>
    </div>
  );
}
