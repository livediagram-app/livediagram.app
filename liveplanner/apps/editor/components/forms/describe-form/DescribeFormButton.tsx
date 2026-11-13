'use client';

// An entry to Describe a Form (docs/specs/030-forms/describe-a-form.md "Where it starts") on an empty Form tab: its
// button, and the dialog, whose code loads only once it is pressed.

import { useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { SparkleIcon } from '@liveplanner/ui';

const DescribeFormHost = dynamic(
  () => import('./DescribeFormHost').then((m) => m.DescribeFormHost),
  { ssr: false },
);

export function DescribeFormButton({
  className,
  children = 'Describe a Form',
}: {
  className: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-describe-form-entry=""
        onClick={() => setOpen(true)}
        className={className}
      >
        <SparkleIcon size={14} aria-hidden className="shrink-0" />
        {children}
      </button>
      {open ? <DescribeFormHost onClose={() => setOpen(false)} /> : null}
    </>
  );
}
