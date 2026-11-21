'use client';

// Who made the page, in the top row's left while it is read (docs/specs/030-knowledgebase/page-surface.md "Who made
// the page"; owner, 2026-11-21: "the avatars of everybody who has created or edited that page, creator first, then all
// the editors, hovering the avatar shows their name"): overlapping discs in Page Health's order (the first writer
// first), an agent as a sparkle, a person by their initials in a colour of their name. Hovering or focusing one
// names them. Edit mode gives the row to the formatting controls, so it shows only while reading.
import type { PageAuthorStamp } from '@liveknowledge/api-schema';
import { Tooltip } from '@liveknowledge/ui';
import { initialsOf } from '@/lib/identity';
import { AgentsIcon } from './knowledge-icons';
import { useKnowledgePeople, usePageKnowledge } from './usePageKnowledge';

/** How many discs stand in the row; the rest are counted in a last "+N" disc. */
export const STACK_MAX = 6;

const TINTS = [
  'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-100',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100',
];
const tintOf = (name: string): string => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return TINTS[Math.abs(h) % TINTS.length]!;
};

export type Maker = { key: string; name: string; ai: boolean; role: string };

/** The discs' people, named: the first is the creator, the rest edited it. A person nobody here can name is a Guest. */
export function makersOf(
  editors: readonly PageAuthorStamp[],
  nameOf: (id: string | undefined) => string | undefined,
): Maker[] {
  return editors.map((s, i) => {
    const ai = s.kind === 'ai';
    const name = ai ? (s.agent ?? 'An Agent') : (nameOf(s.by) ?? 'Guest');
    return {
      key: `${ai ? 'ai' : 'p'}:${ai ? s.agent : s.by}`,
      name,
      ai,
      role: i === 0 ? 'Created' : 'Edited',
    };
  });
}

const DISC =
  'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-white motion-safe:transition-transform motion-safe:duration-150 hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:ring-slate-900';

export function PageMakersStackView({ makers }: { makers: readonly Maker[] }) {
  if (makers.length === 0) return null;
  const shown = makers.slice(0, makers.length > STACK_MAX ? STACK_MAX - 1 : STACK_MAX);
  const rest = makers.length - shown.length;
  return (
    <ul aria-label="Created and Edited By" data-page-makers="" className="flex items-center pl-1">
      {shown.map((m, i) => (
        <li key={m.key} className={i > 0 ? '-ml-1.5' : ''} style={{ zIndex: shown.length - i }}>
          <Tooltip label={`${m.name}, ${m.role}`}>
            <span
              tabIndex={0}
              role="img"
              aria-label={`${m.name}, ${m.role}`}
              className={`${DISC} ${m.ai ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200' : tintOf(m.name)}`}
            >
              {m.ai ? (
                <AgentsIcon />
              ) : (
                <span className="text-optical-centre">{initialsOf(m.name)}</span>
              )}
            </span>
          </Tooltip>
        </li>
      ))}
      {rest > 0 ? (
        <li className="-ml-1.5">
          <Tooltip
            label={makers
              .slice(shown.length)
              .map((m) => m.name)
              .join(', ')}
          >
            <span
              tabIndex={0}
              role="img"
              aria-label={`And ${rest} more`}
              className={`${DISC} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}
            >
              +{rest}
            </span>
          </Tooltip>
        </li>
      ) : null}
    </ul>
  );
}

/** The current page's makers, from Page Health's read (nothing before it, nor Offline). */
export function PageMakersStack() {
  const page = usePageKnowledge();
  const { nameOf } = useKnowledgePeople();
  const editors = page.health?.editors;
  if (!editors) return null;
  return <PageMakersStackView makers={makersOf(editors, nameOf)} />;
}
