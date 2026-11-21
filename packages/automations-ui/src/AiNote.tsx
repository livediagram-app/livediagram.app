'use client';

// A note about AI, with the sparkle: an AI step's cost line, Describe a Rule's, a drafted rule's.

import type { ReactNode } from 'react';
import { SparkleIcon } from '@liveworkspace/ui';

export function AiNote({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p
      id={id}
      className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-[13px] text-brand-900 dark:bg-brand-500/15 dark:text-brand-100"
    >
      <SparkleIcon size={14} aria-hidden className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
