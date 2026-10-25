'use client';

// The liveworkspace logo: the apps' own prism tinted with the platform's slate accent, beside the name with "live"
// in that accent, as each app's wordmark has it. liveworkspace.app's header draws it, and every app's footer names
// the platform with it. Pointing at it turns the prism, as the apps' logos do.

import { useState } from 'react';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { BrandMark } from './Brand';

const SIZES = {
  xs: { text: 'gap-1.5 text-xs font-semibold', mark: 'size-4' },
  md: { text: 'gap-2.5 text-lg font-semibold', mark: 'size-7' },
} as const;

export function WorkspaceWordmark({
  className = '',
  size = 'md',
}: {
  className?: string;
  size?: keyof typeof SIZES;
}) {
  const [spinning, setSpinning] = useState(false);
  return (
    <span
      className={`inline-flex items-center tracking-tight text-slate-900 dark:text-slate-100 ${SIZES[size].text} ${className}`}
      onPointerEnter={(e) => e.pointerType !== 'touch' && setSpinning(true)}
      onPointerLeave={() => setSpinning(false)}
    >
      <BrandMark
        app="livediagram"
        className={`${SIZES[size].mark} shrink-0`}
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
