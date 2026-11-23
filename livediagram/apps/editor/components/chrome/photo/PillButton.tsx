'use client';

import type { ButtonHTMLAttributes } from 'react';
import { SOLID_BRAND_DARK_CONTROL } from '@livediagram/ui';

// The photo review's own buttons (docs/specs/021-event-storming/event-storming.md Phase 9): pills floating over the
// dimmed photograph, the brand fill for the way forward and a white outline beside it. One place for their look, so
// the review's choices all read as one set.
const BASE =
  'pointer-events-auto inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm shadow-lg backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50';
const TONES = {
  primary: `bg-brand-700 font-semibold text-white enabled:hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`,
  outline: 'border border-white/40 bg-slate-900/70 text-white enabled:hover:bg-slate-900/90',
} as const;

export function PillButton({
  tone = 'outline',
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof TONES }) {
  return (
    <button
      type={type}
      className={`${BASE} ${TONES[tone]}${className ? ` ${className}` : ''}`}
      {...rest}
    />
  );
}
