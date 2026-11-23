'use client';

// The meta row's two pills (docs/specs/030-knowledgebase/verification.md "Made by a person or an agent"): who made
// the page and who changed it last, a person or an agent, each with a popover naming them. Neutral grey, never the
// accent or a state colour, so neither reads as a warning; a page with no stamps shows neither. A pill is a button: a
// tap or a click opens its words in a small pointer popover, which Escape or a press outside closes. No hover card:
// the meta row's labelled buttons have none (owner 2026-11-23: "they get in the way").
import { useState } from 'react';
import type { PageAuthorStamp } from '@liveknowledge/api-schema';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { makerPills, type MakerWords } from '@/lib/knowledge/page-makers';
import { MakerAgentIcon, MakerPersonIcon } from './knowledge-icons';

const POPOVER_WIDTH = 248;

// slate-700 on slate-100 and slate-200 on slate-800 both hold well over 4.5:1.
const PILL =
  'inline-flex h-5 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-slate-100 px-2 text-[12px] font-medium leading-none text-slate-700 dark:bg-slate-800 dark:text-slate-200';

const MAKER_ICON = 'text-slate-500 dark:text-slate-400';

export type PageMakers = { created?: PageAuthorStamp; updated?: PageAuthorStamp };

export function PageMakersBadges({
  makers,
  nameOf,
  now,
}: {
  makers: PageMakers;
  nameOf: (id: string | undefined) => string | undefined;
  now: number;
}) {
  const pills = makerPills(makers, nameOf, now);
  if (pills.length === 0) return null;
  return (
    <span data-page-makers="" className="inline-flex items-center gap-1">
      {pills.map((words) => (
        <MakerPill key={words.key} words={words} />
      ))}
    </span>
  );
}

function MakerPill({ words }: { words: MakerWords & { key: string } }) {
  // The pill the popover hangs from while open; null while closed.
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        data-page-maker={words.key}
        data-maker-kind={words.kind}
        onClick={(event) => {
          const button = event.currentTarget;
          setAnchor((was) => (was ? null : button));
        }}
        // `optical-edges`: the leading icon is drawn inside its box with blank space before it, so even padding to
        // the box set the pill's contents 0.9 px right of its centre (optical-alignment.md).
        className={`${PILL} optical-edges focus-visible:outline-2 focus-visible:outline-brand-600`}
      >
        {/* The glyph is the pill's first child, so optical-edges reaches it. */}
        {words.kind === 'ai' ? (
          <MakerAgentIcon className={MAKER_ICON} />
        ) : (
          <MakerPersonIcon className={MAKER_ICON} />
        )}
        {words.label}
      </button>
      {anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name={words.label}
          width={POPOVER_WIDTH}
          pointer
          onClose={() => setAnchor(null)}
        >
          <div data-page-maker-card="" className="p-3">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {words.label}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {words.description}
            </p>
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
