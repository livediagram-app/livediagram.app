'use client';

// A label as the editor draws it (docs/specs/030-knowledgebase/page-surface.md "Page labels"): its colour as a dot
// before its name, in a quiet pill. A standard colour is drawn in its version for each appearance (both are handed to
// CSS, so no appearance is read here); a custom colour is drawn as it is.
import type { CSSProperties } from 'react';
import { isHexColour, standardColours } from '@liveknowledge/document';

const STRONG_LIGHT = new Map<string, string>(
  standardColours('strong', 'light').map((c) => [c.name, c.hex]),
);
const STRONG_DARK = new Map<string, string>(
  standardColours('strong', 'dark').map((c) => [c.name, c.hex]),
);

/** The dot's colour in light and in dark. */
export function labelDotColours(colour: string): { light: string; dark: string } {
  if (isHexColour(colour)) return { light: colour, dark: colour };
  const light = STRONG_LIGHT.get(colour) ?? STRONG_LIGHT.get('grey')!;
  return { light, dark: STRONG_DARK.get(colour) ?? light };
}

export function LabelDot({ colour, size = 8 }: { colour: string; size?: number }) {
  const { light, dark } = labelDotColours(colour);
  return (
    <span
      aria-hidden
      data-label-dot=""
      style={
        {
          '--label-dot': light,
          '--label-dot-dark': dark,
          width: size,
          height: size,
        } as CSSProperties
      }
      className="shrink-0 rounded-full bg-[var(--label-dot)] ring-1 ring-inset ring-black/10 dark:bg-[var(--label-dot-dark)] dark:ring-white/15"
    />
  );
}

export const LABEL_PILL =
  'inline-flex h-6 max-w-[14rem] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 text-[12px] font-medium leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
