'use client';

// Share Form's Embed (docs/specs/030-forms/forms.md "Publishing and the form link"): the `<iframe>` snippet, its
// height (Short, Medium, Tall) and Copy Code.
import { useState } from 'react';
import { Button, SegmentedToggle, useCopiedFlash, type SegmentedOption } from '@liveplanner/ui';
import { track } from '@/lib/telemetry';
import { EMBED_HEIGHT_DEFAULT, EMBED_HEIGHTS, embedCode, type EmbedHeight } from './embed-code';

const HEIGHTS: readonly SegmentedOption<EmbedHeight>[] = [
  { value: 'short', label: 'Short', description: `${EMBED_HEIGHTS.short} px tall` },
  { value: 'medium', label: 'Medium', description: `${EMBED_HEIGHTS.medium} px tall` },
  { value: 'tall', label: 'Tall', description: `${EMBED_HEIGHTS.tall} px tall` },
];

export function ShareEmbedPanel({ url, heading }: { url: string; heading: string }) {
  const [height, setHeight] = useState<EmbedHeight>(EMBED_HEIGHT_DEFAULT);
  const { copied, flash } = useCopiedFlash(1800);
  const code = embedCode(url, heading, height);
  return (
    <div className="flex flex-col gap-2">
      <textarea
        readOnly
        aria-label="Embed code"
        value={code}
        rows={5}
        spellCheck={false}
        onFocus={(e) => e.target.select()}
        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Height</span>
          <SegmentedToggle label="Height" value={height} onChange={setHeight} options={HEIGHTS} />
        </div>
        <Button
          size="sm"
          onClick={() => {
            track('Form', 'Shared', 'Embed');
            void navigator.clipboard?.writeText(code).then(() => flash());
          }}
        >
          {copied ? 'Copied' : 'Copy Code'}
        </Button>
      </div>
      <span role="status" className="sr-only">
        {copied ? 'Embed code copied' : ''}
      </span>
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Paste it into your website’s HTML. The form scrolls inside the frame.
      </p>
    </div>
  );
}
