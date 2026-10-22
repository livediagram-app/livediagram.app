'use client';

// The liveworkspace logo: the apps' own prism (@livediagram/ui's BrandMark, as livediagram.app and
// liveplanner.app draw it in their headers) tinted with the platform's slate accent, beside the name
// with "live" in that accent, as each app's wordmark has it. Pointing at it turns the prism, as theirs
// does.

import { useState } from 'react';
import { BrandMark } from '@livediagram/ui';
import { PLATFORM_SITE } from '@liveworkspace/sites';

export function Wordmark({ className = '' }: { className?: string }) {
  const [spinning, setSpinning] = useState(false);
  return (
    <span
      className={`inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 ${className}`}
      onPointerEnter={(e) => e.pointerType !== 'touch' && setSpinning(true)}
      onPointerLeave={() => setSpinning(false)}
    >
      <BrandMark
        className="size-7 shrink-0"
        accentColor={PLATFORM_SITE.accent}
        spinning={spinning}
      />
      {/* A logotype: WCAG 1.4.3 sets text that is part of a logo no contrast minimum, and the
          contrast audits skip it by this mark. */}
      <span data-logotype="">
        <span className="text-slate-500 dark:text-slate-400">live</span>workspace
      </span>
    </span>
  );
}
