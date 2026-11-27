'use client';

// Who made the page, in the top row's left while it is read (docs/specs/030-knowledgebase/page-surface.md "Who made
// the page"; owner, 2026-11-21: "the avatars of everybody who has created or edited that page, creator first, then all
// the editors, hovering the avatar shows their name"): discs side by side in Page Health's order (owner 2026-11-22: not stacked) (the first writer
// first), an agent as a sparkle, a person by their initials on their presence colour, as their cursor and avatar wear
// it in every app (Work Tracker 1497: their own where Page Health's read brought it, else the one Automatic picks from
// their name). Hovering or focusing one
// names them. Edit mode gives the row to the formatting controls, so it shows only while reading.
import { GUEST_DISC_TINT, GUEST_NAME, isGuestName } from './guest-disc';
import type { PageAuthorStamp } from '@liveknowledge/api-schema';
import { IDENTITY_FILL, Tooltip, identityVars } from '@liveknowledge/ui';
import { presenceColourOf } from '@liveworkspace/settings/presence';
import { agentForPerson } from '@liveworkspace/ui/agent-for-person';
import { initialsOf } from '@/lib/identity';
import { AgentsIcon, MakerPersonIcon } from './knowledge-icons';
import { useKnowledgePeople, usePageKnowledge } from './usePageKnowledge';

/** How many discs stand in the row; the rest are counted in a last "+N" disc. */
export const STACK_MAX = 6;

export type Maker = {
  key: string;
  name: string;
  ai: boolean;
  role: string;
  /** A person's presence colour; absent for an agent and a guest. */
  color?: string;
};

/** The discs' people, named and coloured: the first is the creator, the rest edited it. A person nobody here can name
 *  is a Guest. `colors` holds each person's own colour by id, as Page Health's read brings them. */
export function makersOf(
  editors: readonly PageAuthorStamp[],
  nameOf: (id: string | undefined) => string | undefined,
  colors: Readonly<Record<string, string>> = {},
): Maker[] {
  return editors.map((s, i) => {
    const ai = s.kind === 'ai';
    // An agent names the person it wrote for: "Claude for Priya Shah" (verification.md "An agent acting for a person").
    const name = ai
      ? agentForPerson(s.agent, nameOf(s.by), 'An Agent')
      : (nameOf(s.by) ?? GUEST_NAME);
    return {
      key: `${ai ? 'ai' : 'p'}:${ai ? s.agent : s.by}`,
      name,
      ai,
      role: i === 0 ? 'Created' : 'Edited',
      ...(ai || isGuestName(name) ? {} : { color: presenceColourOf(name, colors[s.by]) }),
    };
  });
}

const DISC =
  'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold motion-safe:transition-transform motion-safe:duration-150 hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';

export function PageMakersStackView({ makers }: { makers: readonly Maker[] }) {
  if (makers.length === 0) return null;
  const shown = makers.slice(0, makers.length > STACK_MAX ? STACK_MAX - 1 : STACK_MAX);
  const rest = makers.length - shown.length;
  return (
    <ul
      aria-label="Created and Edited By"
      data-page-makers=""
      className="flex items-center gap-1 pl-1"
    >
      {shown.map((m) => (
        <li key={m.key}>
          <Tooltip label={`${m.name}, ${m.role}`}>
            <span
              tabIndex={0}
              role="img"
              aria-label={`${m.name}, ${m.role}`}
              style={m.color ? identityVars(m.color) : undefined}
              className={`${DISC} ${m.color ? IDENTITY_FILL : m.ai ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200' : GUEST_DISC_TINT}`}
            >
              {m.color ? (
                <span className="text-optical-centre">{initialsOf(m.name)}</span>
              ) : m.ai ? (
                <AgentsIcon />
              ) : (
                <MakerPersonIcon />
              )}
            </span>
          </Tooltip>
        </li>
      ))}
      {rest > 0 ? (
        <li>
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
  return <PageMakersStackView makers={makersOf(editors, nameOf, page.health?.colors)} />;
}
