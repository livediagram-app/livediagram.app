'use client';

import { Glyph } from '@liveworkspace/ui';
import type { ChromeToolsItem } from './ChromeToolsMenu';

/** A session's access level, as each app's api-schema names it. */
export type Role = 'edit' | 'participate' | 'view';

// Experiment (livediagram, livedocuments): the header's role pill as a Tool. Someone whose role allows editing picks how they see the item
// (Editing, Participating, Viewing) straight from Tools; the pill's tones carry over to each option's plate.

const OPTIONS: { role: Role; label: string; description: string; plate: string }[] = [
  {
    role: 'edit',
    label: 'Editing',
    description: 'Change anything.',
    plate:
      'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  },
  {
    role: 'participate',
    label: 'Participating',
    description: 'See it as a Participant: add and vote, not restructure.',
    plate:
      'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30',
  },
  {
    role: 'view',
    label: 'Viewing',
    description: 'Read only, as a Viewer sees it.',
    plate:
      'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
  },
];

const WORD: Record<Role, string> = {
  edit: 'Editing',
  participate: 'Participating',
  view: 'Viewing',
};

// The row's own glyph: a person with the two-way arrows of a switch (the options keep the pill's glyphs).
function SwitchGlyph() {
  return (
    <Glyph size={16} units={16}>
      <circle cx="5.5" cy="5" r="2.2" />
      <path d="M1.5 13c.5-2.3 2-3.6 4-3.6 1 0 1.9.3 2.6.9M10 7.5h4.5l-1.5-1.5M14.5 11.5H10l1.5 1.5" />
    </Glyph>
  );
}

function RoleGlyph({ role }: { role: Role }) {
  return (
    <Glyph size={16} units={16}>
      {role === 'edit' ? (
        <path d="M10.5 2.5l3 3L6 13H3v-3z" />
      ) : role === 'participate' ? (
        <>
          <circle cx="6" cy="6" r="2.2" />
          <path d="M2 13c.6-2.2 2.1-3.4 4-3.4s3.4 1.2 4 3.4M11 4.5v4M9 6.5h4" />
        </>
      ) : (
        <>
          <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
          <circle cx="8" cy="8" r="2" />
        </>
      )}
    </Glyph>
  );
}

/** The Tools row: only for someone whose role allows editing (a Participant's and a Viewer's role is fixed). */
export function roleToolsItem(role: {
  role: Role;
  // "Owned by you", "Owned by Sam" (each app's roleOwnerLabel), or empty.
  owner: string;
  // The thing's noun: "canvas", "document".
  noun: string;
  canSwitch: boolean;
  onPick: (role: Role) => void;
}): ChromeToolsItem | null {
  if (!role.canSwitch) return null;
  const { owner } = role;
  return {
    id: 'role',
    group: 'collaborate',
    label: 'Editing Mode',
    description: `Edit, or see the ${role.noun} as a Participant or a Viewer.`,
    icon: <SwitchGlyph />,
    aside: (
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {WORD[role.role]}
      </span>
    ),
    onSelect: () => {},
    view: ({ close }) => (
      <div className="flex flex-col gap-1 px-2 pb-3">
        <div role="radiogroup" aria-label="Editing mode" className="flex flex-col gap-1">
          {OPTIONS.map((o) => {
            const on = o.role === role.role;
            return (
              <button
                key={o.role}
                type="button"
                role="radio"
                aria-checked={on}
                data-role-option={o.role}
                onClick={() => {
                  role.onPick(o.role);
                  close();
                }}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition ${
                  on
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${o.plate}`}
                >
                  <RoleGlyph role={o.role} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                    {o.label}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {o.description}
                  </span>
                </span>
                {on ? (
                  <Glyph
                    size={14}
                    units={16}
                    className="shrink-0 text-brand-700 dark:text-brand-300"
                  >
                    <path d="M3 8.5l3 3 7-7" />
                  </Glyph>
                ) : null}
              </button>
            );
          })}
        </div>
        {owner ? (
          <p className="px-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
            {owner}. Only you see the switch; everyone else keeps their own role.
          </p>
        ) : null}
      </div>
    ),
  };
}
